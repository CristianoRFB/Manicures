import { assertCommercialChange, evaluate, getLimit, type CommercialState } from "../../src/commercial/entitlements";
import type { Tenant } from "../../src/domain/types";

interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  ALLOWED_ORIGIN?: string;
  FIREBASE_AUTH_PROJECT_ID?: string;
  FIRESTORE_EMULATOR_HOST?: string;
  FIREBASE_AUTH_EMULATOR_HOST?: string;
}

type FireValue = { stringValue?: string; integerValue?: string; booleanValue?: boolean; mapValue?: { fields: Record<string, FireValue> }; arrayValue?: { values: FireValue[] } };
type FireDoc = { name: string; fields?: Record<string, FireValue>; updateTime?: string };

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function cors(env: Env) {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN ?? "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
}

function json(env: Env, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...cors(env) } });
}

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function serviceAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(env.FIREBASE_PRIVATE_KEY), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const assertion = `${unsigned}.${b64url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`Falha ao autenticar service account (${response.status}).`);
  const data = await response.json() as { access_token: string };
  return data.access_token;
}

function base(env: Env) {
  if (env.FIRESTORE_EMULATOR_HOST) return `http://${env.FIRESTORE_EMULATOR_HOST}/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}
function commitUrl(env: Env) {
  if (env.FIRESTORE_EMULATOR_HOST) return `http://${env.FIRESTORE_EMULATOR_HOST}/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;
}
function docName(env: Env, path: string) { return `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`; }

async function getDocument(env: Env, token: string, path: string): Promise<FireDoc | null> {
  const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${base(env)}/${path}`, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore GET ${path} falhou (${response.status}).`);
  return response.json() as Promise<FireDoc>;
}

function asRecord(value: FireValue | undefined): Record<string, FireValue> {
  return value?.mapValue?.fields ?? {};
}
function parseCommercial(tenant: FireDoc): CommercialState | undefined {
  const f = tenant.fields?.commercial?.mapValue?.fields;
  if (!f || !f.planId?.stringValue || !f.subscriptionStatus?.stringValue) return undefined;
  const entitlementOverrides: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(asRecord(f.entitlementOverrides))) {
    if (value.booleanValue !== undefined) entitlementOverrides[key] = value.booleanValue;
  }
  const limitOverrides: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(asRecord(f.limitOverrides))) {
    if (value.integerValue !== undefined) limitOverrides[key] = Number(value.integerValue);
    else if (value.stringValue === "__NULL__") limitOverrides[key] = null;
  }
  return {
    planId: f.planId.stringValue,
    subscriptionStatus: f.subscriptionStatus.stringValue as CommercialState["subscriptionStatus"],
    trialUntil: f.trialUntil?.stringValue || null,
    entitlementOverrides,
    limitOverrides,
  };
}
function asTenant(doc: FireDoc, tenantId: string): Tenant {
  return {
    id: tenantId,
    status: (str(doc, "status") || "suspended") as Tenant["status"],
    kind: (str(doc, "kind") || "real") as Tenant["kind"],
    commercial: parseCommercial(doc),
  } as Tenant;
}
function parseBase64Url(encoded: string): Uint8Array {
  const raw = atob(encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "="));
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}
async function verifyFirebaseIdToken(raw: string, env: Env): Promise<string> {
  const parts = raw.split(".");
  if (parts.length !== 3) throw new Error("Token inválido.");
  const header = JSON.parse(new TextDecoder().decode(parseBase64Url(parts[0]))) as {kid?:string; alg?:string};
  const payload = JSON.parse(new TextDecoder().decode(parseBase64Url(parts[1]))) as {
    aud?:string; iss?:string; sub?:string; exp?:number; iat?:number; auth_time?:number;
  };
  const project = env.FIREBASE_AUTH_PROJECT_ID ?? env.FIREBASE_PROJECT_ID;
  const now = Math.floor(Date.now() / 1000);
  // Local-only Auth Emulator support. Production path always requires a signed RS256 JWT.
  const emulatorMode = env.FIREBASE_PROJECT_ID === "manicure-demo"
    && env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8080"
    && env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:9099";
  if(emulatorMode && header.alg==="none" && parts[2]===""
    && payload.aud === "manicure-demo"
    && payload.iss === "https://securetoken.google.com/manicure-demo"
    && payload.sub && payload.sub.length<=128
    && payload.exp && payload.exp>now && payload.iat && payload.iat<=now &&
    payload.auth_time && payload.auth_time<=now){
    // The emulator is the trust boundary. An unsigned, hand-crafted JWT without an
    // active corresponding emulator session is rejected by the lookup endpoint.
    const result=await fetch(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({idToken:raw}),
      });
    if(!result.ok)throw new Error("Sessão do Auth Emulator inválida.");
    const response=await result.json() as {users?:Array<{localId:string;disabled?:boolean}>};
    if(response.users?.length!==1 || response.users[0].localId!==payload.sub || response.users[0].disabled)
      throw new Error("Conta do Auth Emulator inválida.");
    return payload.sub;
  }
  if (header.alg !== "RS256" || !header.kid ||
      payload.aud !== project || payload.iss !== `https://securetoken.google.com/${project}` ||
      !payload.sub || payload.sub.length > 128 ||
      !payload.exp || payload.exp <= now || !payload.iat || payload.iat > now ||
      !payload.auth_time || payload.auth_time > now)
    throw new Error("Token inválido ou expirado.");
  const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if (!response.ok) throw new Error("Chaves públicas indisponíveis.");
  const jwks = await response.json() as {keys: Array<JsonWebKey & {kid?:string}>};
  const jwk = jwks.keys.find((item) => item.kid === header.kid);
  if (!jwk) throw new Error("Assinatura não reconhecida.");
  const key = await crypto.subtle.importKey("jwk", jwk, {name:"RSASSA-PKCS1-v1_5", hash:"SHA-256"}, false, ["verify"]);
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, parseBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!verified) throw new Error("Assinatura inválida.");
  return payload.sub;
}

function str(doc: FireDoc, key: string): string { return doc.fields?.[key]?.stringValue ?? ""; }
function int(doc: FireDoc, key: string): number { return Number(doc.fields?.[key]?.integerValue ?? NaN); }
function bool(doc: FireDoc, key: string): boolean { return doc.fields?.[key]?.booleanValue === true; }
function arr(doc: FireDoc, key: string): string[] { return doc.fields?.[key]?.arrayValue?.values?.map((v) => v.stringValue ?? "").filter(Boolean) ?? []; }

function localParts(iso: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):00$/.exec(iso);
  if (!match) throw new Error("Horário inválido.");
  const minute = Number(match[2]) * 60 + Number(match[3]);
  return { dateKey: match[1], startMinute: minute };
}

function field(value: unknown): FireValue {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(field) } };
  if (value && typeof value === "object") {
    const fields: Record<string, FireValue> = {};
    for (const [k, v] of Object.entries(value)) fields[k] = field(v);
    return { mapValue: { fields } };
  }
  return { stringValue: "" };
}

function fields(record: Record<string, unknown>) {
  const out: Record<string, FireValue> = {};
  for (const [key, value] of Object.entries(record)) out[key] = field(value);
  return out;
}

function addMinutes(iso: string, minutes: number): string {
  const { dateKey, startMinute } = localParts(iso);
  const total = startMinute + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${dateKey}T${hh}:${mm}:00`;
}

function lockMinutes(startMinute: number, endMinute: number): number[] {
  const out: number[] = [];
  for (let minute = Math.floor(startMinute / 15) * 15; minute < endMinute; minute += 15) out.push(minute);
  return out;
}

function settings(doc:FireDoc) {
  const fields=asRecord(doc.fields?.businessSettings);
  return {
    timezone:fields.timezone?.stringValue || "America/Sao_Paulo",
    bookingHorizonDays:Number(fields.bookingHorizonDays?.integerValue ?? 45),
    minLeadMinutes:Number(fields.minLeadMinutes?.integerValue ?? 60),
  };
}
function zonedNowString(zone:string):string {
  const fmt=new Intl.DateTimeFormat("en-US",{
    timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  });
  const values=Object.fromEntries(fmt.formatToParts(new Date()).map(x=>[x.type,x.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:00`;
}
function validDate(date:string):boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`))
    && new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)===date;
}
function validWindow(tenant:FireDoc,start:string) {
  const {timezone,bookingHorizonDays,minLeadMinutes}=settings(tenant);
  const nowLocal=zonedNowString(timezone);
  const startMs=Date.parse(`${start}Z`),nowMs=Date.parse(`${nowLocal}Z`);
  const gapMinutes=(startMs-nowMs)/60000;
  return Number.isFinite(gapMinutes) && gapMinutes >= minLeadMinutes
    && gapMinutes <= bookingHorizonDays*1440;
}
type DailyHours = {closed:boolean;startMinute:number;endMinute:number;breakStartMinute:number;breakEndMinute:number};
const DEFAULT_HOURS:DailyHours={closed:false,startMinute:540,endMinute:1080,breakStartMinute:720,breakEndMinute:780};
function dayKey(date:string):string{return String(new Date(`${date}T12:00:00Z`).getUTCDay());}
function scheduleFor(professional:FireDoc,date:string):DailyHours {
  const entry=asRecord(asRecord(professional.fields?.weeklyHours)[dayKey(date)]);
  if(!Object.keys(entry).length)return DEFAULT_HOURS;
  return {
    closed:entry.closed?.booleanValue===true,
    startMinute:Number(entry.startMinute?.integerValue ?? DEFAULT_HOURS.startMinute),
    endMinute:Number(entry.endMinute?.integerValue ?? DEFAULT_HOURS.endMinute),
    breakStartMinute:Number(entry.breakStartMinute?.integerValue ?? DEFAULT_HOURS.breakStartMinute),
    breakEndMinute:Number(entry.breakEndMinute?.integerValue ?? DEFAULT_HOURS.breakEndMinute),
  };
}
function inWorkingHours(hours:DailyHours,start:number,end:number):boolean {
  return !hours.closed && start>=hours.startMinute && end<=hours.endMinute &&
    !(start<hours.breakEndMinute && end>hours.breakStartMinute);
}
function validateHours(h:DailyHours):boolean {
  return typeof h.closed==="boolean" &&
    [h.startMinute,h.endMinute,h.breakStartMinute,h.breakEndMinute].every(Number.isSafeInteger) &&
    h.startMinute>=0 && h.startMinute<1440 && h.endMinute>h.startMinute && h.endMinute<=1440 &&
    h.breakStartMinute>=h.startMinute && h.breakEndMinute<=h.endMinute &&
    h.breakStartMinute<=h.breakEndMinute;
}
async function configureProfessionalHours(request:Request,env:Env):Promise<Response> {
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const professionalId=typeof data.professionalId==="string"?data.professionalId:"";
  const weekday=data.weekday;
  const closed=data.closed;
  const hours:DailyHours={closed:closed===true,startMinute:Number(data.startMinute),endMinute:Number(data.endMinute),
    breakStartMinute:Number(data.breakStartMinute),breakEndMinute:Number(data.breakEndMinute)};
  if(![tenantId,professionalId].every(x=>/^[A-Za-z0-9_-]{1,100}$/.test(x))||
      !Number.isSafeInteger(weekday)||Number(weekday)<0||Number(weekday)>6||typeof closed!=="boolean"||!validateHours(hours))
    return json(env,{error:"Horário inválido; configure período e intervalo dentro do expediente."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor)return json(env,{error:"Sem permissão para alterar a agenda."},403);
  const [tenant,professional]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    getDocument(env,token,`tenants/${tenantId}/professionals/${professionalId}`),
  ]);
  if(!tenant||str(tenant,"status")!=="active"||!professional||!professional.updateTime)
    return json(env,{error:"Tenant ou profissional indisponível."},404);
  const dateToday=zonedNowString(settings(tenant).timezone).slice(0,10);
  const allAppointments=await listDocuments(env,token,`tenants/${tenantId}/appointments`);
  for(const appointment of allAppointments){
    const start=str(appointment,"startsAt"),end=str(appointment,"endsAt");
    if(str(appointment,"professionalId")!==professionalId||start.slice(0,10)<dateToday ||
       dayKey(start.slice(0,10))!==String(weekday)||!["pending","confirmed","in_service"].includes(str(appointment,"status")))continue;
    const first=localParts(start).startMinute,last=localParts(end).startMinute;
    if(!inWorkingHours(hours,first,last))
      return json(env,{error:"Há atendimento futuro que ficaria fora desse expediente. Reagende ou cancele antes."},409);
  }
  const weekly=asRecord(professional.fields?.weeklyHours);
  const normalized:Record<string,unknown>={};
  for(const [key,value] of Object.entries(weekly)){
    const row=asRecord(value);
    normalized[key]={
      closed:row.closed?.booleanValue===true,
      startMinute:Number(row.startMinute?.integerValue ?? DEFAULT_HOURS.startMinute),
      endMinute:Number(row.endMinute?.integerValue ?? DEFAULT_HOURS.endMinute),
      breakStartMinute:Number(row.breakStartMinute?.integerValue ?? DEFAULT_HOURS.breakStartMinute),
      breakEndMinute:Number(row.breakEndMinute?.integerValue ?? DEFAULT_HOURS.breakEndMinute),
    };
  }
  normalized[String(weekday)]=hours;
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const before=normalized[String(weekday)]===hours ? (
    weekly[String(weekday)] ? {
      closed:asRecord(weekly[String(weekday)]).closed?.booleanValue===true,
      startMinute:Number(asRecord(weekly[String(weekday)]).startMinute?.integerValue ?? DEFAULT_HOURS.startMinute),
      endMinute:Number(asRecord(weekly[String(weekday)]).endMinute?.integerValue ?? DEFAULT_HOURS.endMinute),
      breakStartMinute:Number(asRecord(weekly[String(weekday)]).breakStartMinute?.integerValue ?? DEFAULT_HOURS.breakStartMinute),
      breakEndMinute:Number(asRecord(weekly[String(weekday)]).breakEndMinute?.integerValue ?? DEFAULT_HOURS.breakEndMinute),
    }:DEFAULT_HOURS
  ):DEFAULT_HOURS;
  const writes=[
    {update:{name:docName(env,`tenants/${tenantId}/professionals/${professionalId}`),
      fields:fields({weeklyHours:normalized,updatedAt:now})},
      updateMask:{fieldPaths:["weeklyHours","updatedAt"]},
      currentDocument:{updateTime:professional.updateTime}},
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,action:"professionals.schedule_update",
        resourceType:"professional",resourceId:professionalId,before:{weekday,hours:before},after:{weekday,hours},
        createdAt:now})},currentDocument:{exists:false}},
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const detail=await response.text();
    if([409,412].includes(response.status)||/FAILED_PRECONDITION|ABORTED/.test(detail))
      return json(env,{error:"Agenda alterada simultaneamente. Atualize e tente novamente."},409);
    console.error("Schedule update failed",response.status,detail.slice(0,200));
    return json(env,{error:"Não foi possível salvar agenda."},500);
  }
  return json(env,{ok:true,professionalId,weekday,hours,auditId});
}

async function availableSlots(env:Env,token:string,tenantId:string,tenant:FireDoc,service:FireDoc,professional:FireDoc,date:string,excludeAppointmentId?:string) {
  if(!validDate(date)) return [] as string[];
  if (!evaluate(asTenant(tenant,tenantId),"booking.create").allowed || !bool(service,"active")
      || !bool(professional,"active")) return [] as string[];
  const duration=int(service,"durationMin");
  if (!Number.isSafeInteger(duration)||duration<=0||duration>480) return [] as string[];
  const proId=professional.name.split("/").pop() ?? "";
  const ids=arr(professional,"serviceIds");
  const serviceId=service.name.split("/").pop() ?? "";
  if(!ids.includes(serviceId)) return [] as string[];
  const [locks,blocks]=await Promise.all([
    listDocuments(env,token,`tenants/${tenantId}/bookingLocks`),
    listDocuments(env,token,`tenants/${tenantId}/scheduleBlocks`),
  ]);
  const busy=new Set(locks.filter(lock=>str(lock,"professionalId")===proId && str(lock,"dateKey")===date && (!excludeAppointmentId || str(lock,"appointmentId")!==excludeAppointmentId)).map(lock=>int(lock,"minute")));
  const intervals=blocks.filter(block=>str(block,"professionalId")===proId && block.fields?.active?.booleanValue!==false).map(block=>({
    start:str(block,"startsAt"),end:str(block,"endsAt"),
  })).filter(block=>block.start && block.end);
  const result:string[]=[];
  const hours=scheduleFor(professional,date);
  if(!validateHours(hours)||hours.closed)return result;
  for(let minutes=hours.startMinute;minutes+duration<=hours.endMinute;minutes+=30) {
    if(!inWorkingHours(hours,minutes,minutes+duration))continue;
    const start=`${date}T${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}:00`;
    if(!validWindow(tenant,start))continue;
    const end=addMinutes(start,duration);
    const occupied=lockMinutes(minutes,minutes+duration).some(minute=>busy.has(minute));
    const blocked=intervals.some(block=>start<block.end && end>block.start);
    if(!occupied && !blocked)result.push(start);
  }
  return result;
}
async function lookupAvailability(request:Request,env:Env):Promise<Response> {
  const u=new URL(request.url);
  const tenantId=u.searchParams.get("tenantId") ?? "";
  const serviceId=u.searchParams.get("serviceId") ?? "";
  const professionalId=u.searchParams.get("professionalId") ?? "";
  const date=u.searchParams.get("date") ?? "";
  if(![tenantId,serviceId,professionalId].every(x=>/^[A-Za-z0-9_-]{1,100}$/.test(x))||!validDate(date))
    return json(env,{error:"Parâmetros inválidos."},400);
  const token=env.FIRESTORE_EMULATOR_HOST ? "" : await serviceAccessToken(env);
  const [tenant,service,professional]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    getDocument(env,token,`tenants/${tenantId}/services/${serviceId}`),
    getDocument(env,token,`tenants/${tenantId}/professionals/${professionalId}`),
  ]);
  if(!tenant || str(tenant,"status")!=="active")return json(env,{error:"Tenant indisponível."},404);
  if(!service || !professional) return json(env,{error:"Serviço ou profissional indisponível."},404);
  const slots=await availableSlots(env,token,tenantId,tenant,service,professional,date);
  return json(env,{slots,date,timezone:settings(tenant).timezone});
}

async function createBooking(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const tenantId = String(body.tenantId ?? "");
  const serviceId = String(body.serviceId ?? "");
  const professionalId = String(body.professionalId ?? "");
  const startsAt = String(body.startsAt ?? "");
  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const phoneDigits=customerPhone.replace(/\D/g,"");
  if(![tenantId,serviceId,professionalId].every(id=>/^[A-Za-z0-9_-]{1,100}$/.test(id))||
     customerName.length<2||customerName.length>100||phoneDigits.length<10||phoneDigits.length>15||
     !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(startsAt))
    return json(env,{error:"Informe nome, telefone válido e horário."},400);

  const token = env.FIRESTORE_EMULATOR_HOST ? "" : await serviceAccessToken(env);
  const [tenant, service, professional] = await Promise.all([
    getDocument(env, token, `tenants/${tenantId}`),
    getDocument(env, token, `tenants/${tenantId}/services/${serviceId}`),
    getDocument(env, token, `tenants/${tenantId}/professionals/${professionalId}`),
  ]);
  if (!tenant || str(tenant, "status") !== "active") return json(env, { error: "Tenant indisponível." }, 404);
  if (!service || !bool(service, "active")) return json(env, { error: "Serviço indisponível." }, 400);
  if (!professional || !bool(professional, "active") || !arr(professional, "serviceIds").includes(serviceId)) return json(env, { error: "Profissional indisponível para o serviço." }, 400);

  if (!evaluate(asTenant(tenant, tenantId), "booking.create").allowed) {
    return json(env, { error: "Agendamentos indisponíveis para o estado comercial deste tenant." }, 403);
  }

  const duration = int(service, "durationMin");
  const price = int(service, "priceCents");
  if (!Number.isInteger(duration) || duration <= 0 || !Number.isInteger(price) || price < 0) return json(env, { error: "Configuração de serviço inválida." }, 500);

  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId) || !/^[A-Za-z0-9_-]{1,100}$/.test(serviceId)
      || !/^[A-Za-z0-9_-]{1,100}$/.test(professionalId))
    return json(env,{error:"Identificadores inválidos."},400);
  const {dateKey, startMinute}=localParts(startsAt);
  const slots=await availableSlots(env,token,tenantId,tenant,service,professional,dateKey);
  if(!slots.includes(startsAt)) return json(env,{error:"Horário indisponível. Atualize os horários."},409);
  const endMinute = startMinute + duration;
  if (!inWorkingHours(scheduleFor(professional,dateKey),startMinute,endMinute)) return json(env,{error:"Fora do expediente da profissional."},409);

  const appointmentId = crypto.randomUUID();
  const endsAt = addMinutes(startsAt, duration);
  const now = new Date().toISOString();
  const locks = lockMinutes(startMinute, endMinute).map((minute) => ({ id: `${professionalId}_${dateKey}_${minute}`, minute }));

  const writes = [
    {
      update: {
        name: docName(env, `tenants/${tenantId}/appointments/${appointmentId}`),
        fields: fields({ appointmentId, tenantId, customerName, customerPhone:phoneDigits, professionalId, serviceId, startsAt, endsAt, dateKey, startMinute, endMinute, priceSnapshotCents: price, durationSnapshotMin: duration, status: "pending", createdAt: now, updatedAt: now }),
      },
      currentDocument: { exists: false },
    },
    ...locks.map(({ id, minute }) => ({
      update: {
        name: docName(env, `tenants/${tenantId}/bookingLocks/${id}`),
        fields: fields({ tenantId, professionalId, appointmentId, dateKey, minute, createdAt: now }),
      },
      currentDocument: { exists: false },
    })),
  ];

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(commitUrl(env), {
    method: "POST",
    headers,
    body: JSON.stringify({ writes }),
  });

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 409 || response.status === 412 || detail.includes("ALREADY_EXISTS") || detail.includes("FAILED_PRECONDITION")) {
      return json(env, { error: "Horário indisponível. Escolha outro slot." }, 409);
    }
    console.error("Firestore booking commit failed", response.status, detail.slice(0, 500));
    return json(env, { error: "Não foi possível criar o agendamento." }, 500);
  }

  return json(env, { appointment: { id: appointmentId, tenantId, customerName, customerPhone:phoneDigits, professionalId, serviceId, startsAt, endsAt, priceSnapshotCents: price, durationSnapshotMin: duration, status: "pending", createdAt: now, updatedAt: now } }, 201);
}

/** Manual plan assignment only. Never accepts a caller-supplied actorId or price. */
async function assignPlan(request: Request, env: Env): Promise<Response> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json(env, {error:"Autenticação necessária."}, 401);
  let actorId: string;
  try { actorId = await verifyFirebaseIdToken(authorization.slice(7), env); }
  catch { return json(env, {error:"Token inválido ou expirado."}, 401); }

  const data = await request.json() as Record<string, unknown>;
  const tenantId = typeof data.tenantId === "string" ? data.tenantId : "";
  const planId = typeof data.planId === "string" ? data.planId : "";
  const status = typeof data.subscriptionStatus === "string" ? data.subscriptionStatus : "";
  const reason = typeof data.reason === "string" ? data.reason.trim() : "";
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(tenantId) || reason.length < 10 || reason.length > 600)
    return json(env, {error:"Tenant ou justificativa inválidos (10 a 600 caracteres)."}, 400);
  if (!["active","trial","past_due","suspended","cancelled","demo"].includes(status))
    return json(env, {error:"Status inválido."}, 400);

  const serverToken = env.FIRESTORE_EMULATOR_HOST ? "" : await serviceAccessToken(env);
  const platform = await getDocument(env, serverToken, `platformUsers/${actorId}`);
  if (!platform || str(platform,"role") !== "platform_owner" || str(platform,"status") !== "active")
    return json(env, {error:"Acesso negado."}, 403);

  const tenant = await getDocument(env, serverToken, `tenants/${tenantId}`);
  if (!tenant || !tenant.updateTime) return json(env, {error:"Tenant não encontrado."}, 404);

  const previous = parseCommercial(tenant) ?? null;
  const now = new Date();
  const trialUntil = status === "trial" ? new Date(now.getTime() + 14*24*60*60*1000).toISOString() : null;
  const changes: CommercialState = {
    planId, subscriptionStatus: status as CommercialState["subscriptionStatus"],
    trialUntil,
    entitlementOverrides: typeof data.entitlementOverrides === "object" && data.entitlementOverrides && !Array.isArray(data.entitlementOverrides)
      ? data.entitlementOverrides as Record<string, boolean>
      : previous?.entitlementOverrides ?? {},
    limitOverrides: typeof data.limitOverrides === "object" && data.limitOverrides && !Array.isArray(data.limitOverrides)
      ? data.limitOverrides as Record<string, number | null>
      : previous?.limitOverrides ?? {},
  };
  try { assertCommercialChange(changes, str(tenant, "kind") as Tenant["kind"]); }
  catch(error) { return json(env, {error:error instanceof Error ? error.message : "Configuração inválida."},400); }

  const auditId = crypto.randomUUID();
  const writes = [
    {
      update: {name:docName(env, `tenants/${tenantId}`), fields:{commercial:field({
        ...changes, trialUntilEpochMs: trialUntil ? Date.parse(trialUntil) : 0, limitOverrides: Object.fromEntries(Object.entries(changes.limitOverrides ?? {}).map(([k,v])=>[k,v===null?"__NULL__":v])),
      })}},
      updateMask:{fieldPaths:["commercial"]},
      currentDocument:{updateTime:tenant.updateTime},
    },
    {
      update:{
        name:docName(env, `tenants/${tenantId}/auditLogs/${auditId}`),
        fields:fields({
          actorId, actorRole:"platform_owner", tenantId, action:"commercial.manual_assignment",
          resourceType:"tenant", resourceId:tenantId, before:previous ?? {}, after:changes,
          reason, createdAt:now.toISOString(),
        }),
      },
      currentDocument:{exists:false},
    },
  ];
  const headers: Record<string,string> = {"content-type":"application/json"};
  if (serverToken) headers.authorization = `Bearer ${serverToken}`;
  const response = await fetch(commitUrl(env), {method:"POST",headers,body:JSON.stringify({writes})});
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 409 || response.status === 412 || detail.includes("FAILED_PRECONDITION"))
      return json(env,{error:"Configuração modificada em outra sessão. Recarregue antes de salvar."},409);
    console.error("Manual assignment commit failed",response.status,detail.slice(0,200));
    return json(env,{error:"Não foi possível atualizar o plano."},500);
  }
  return json(env,{ok:true,tenantId,commercial:changes,auditId});
}

async function listDocuments(env: Env, token: string, path: string): Promise<FireDoc[]> {
  const output: FireDoc[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({pageSize:"200"});
    if (pageToken) query.set("pageToken",pageToken);
    const headers: Record<string,string> = token ? {authorization:`Bearer ${token}`} : {};
    const response = await fetch(`${base(env)}/${path}?${query}`,{headers});
    if (response.status === 404) return output;
    if (!response.ok) throw new Error(`Firestore LIST failed (${response.status}).`);
    const data = await response.json() as {documents?:FireDoc[];nextPageToken?:string};
    output.push(...(data.documents ?? []));
    if (output.length > 10000) throw new Error("Quantidade acima do limite operacional de conferência.");
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return output;
}
async function tenantAdminIdentity(request: Request, env: Env, tenantId: string, serverToken: string): Promise<{actorId:string;actorRole:string} | null> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  let actorId: string;
  try { actorId=await verifyFirebaseIdToken(authorization.slice(7),env); }
  catch { return null; }
  const platform = await getDocument(env,serverToken,`platformUsers/${actorId}`);
  if (platform && str(platform,"role")==="platform_owner" && str(platform,"status")==="active")
    return {actorId,actorRole:"platform_owner"};
  const membership = await getDocument(env,serverToken,`memberships/${tenantId}_${actorId}`);
  if (!membership || str(membership,"tenantId")!==tenantId || str(membership,"userId")!==actorId
      || str(membership,"status")!=="active" || !["tenant_owner","tenant_admin"].includes(str(membership,"role"))) return null;
  return {actorId,actorRole:str(membership,"role")};
}

async function createProfessional(request: Request, env: Env): Promise<Response> {
  const data = await request.json() as Record<string,unknown>;
  const tenantId = typeof data.tenantId==="string" ? data.tenantId : "";
  const name = typeof data.name==="string" ? data.name.trim() : "";
  const serviceIds = Array.isArray(data.serviceIds) && data.serviceIds.every(id=>typeof id==="string") ? data.serviceIds as string[] : [];
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(tenantId) || name.length<2 || name.length>100 || serviceIds.length>40
      || serviceIds.some(id=>!/^[a-zA-Z0-9_-]{1,100}$/.test(id))) return json(env,{error:"Profissional ou tenant inválido."},400);
  const serverToken = env.FIRESTORE_EMULATOR_HOST ? "" : await serviceAccessToken(env);
  const actor = await tenantAdminIdentity(request,env,tenantId,serverToken);
  if (!actor) return json(env,{error:"Sessão sem permissão para equipe."},403);
  const tenant = await getDocument(env,serverToken,`tenants/${tenantId}`);
  if (!tenant || str(tenant,"status")!=="active") return json(env,{error:"Tenant indisponível."},403);
  const cap = getLimit(asTenant(tenant,tenantId),"professionals_active");
  if (cap===0) return json(env,{error:"Plano não atribuído ou inativo."},403);
  const allowedServices = await Promise.all(serviceIds.map(id=>getDocument(env,serverToken,`tenants/${tenantId}/services/${id}`)));
  if (allowedServices.some(doc=>!doc || !bool(doc,"active"))) return json(env,{error:"Serviço não pertence ao tenant ou está inativo."},400);

  const counterPath=`tenants/${tenantId}/usage/staff`;
  const counter=await getDocument(env,serverToken,counterPath);
  const existing = counter
    ? int(counter,"professionalsActive")
    : (await listDocuments(env,serverToken,`tenants/${tenantId}/professionals`)).filter(p=>bool(p,"active")).length;
  if (!Number.isSafeInteger(existing)||existing<0) return json(env,{error:"Contagem de profissionais inconsistente."},409);
  if (cap!==null && existing>=cap) return json(env,{error:`Limite de profissionais atingido (${existing}/${cap}).`},409);

  const now=new Date().toISOString(),professionalId=crypto.randomUUID(),auditId=crypto.randomUUID();
  const writes=[
    {
      update:{name:docName(env,`tenants/${tenantId}/professionals/${professionalId}`),
        fields:fields({tenantId,name,serviceIds,active:true,createdAt:now,updatedAt:now})},
      currentDocument:{exists:false},
    },
    {
      update:{name:docName(env,counterPath),fields:fields({professionalsActive:existing+1,updatedAt:now})},
      updateMask:{fieldPaths:["professionalsActive","updatedAt"]},
      currentDocument: counter?.updateTime ? {updateTime:counter.updateTime} : {exists:false},
    },
    {
      update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
        fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,action:"professionals.create",
          resourceType:"professional",resourceId:professionalId,before:{},after:{tenantId,name,serviceIds,active:true},createdAt:now})},
      currentDocument:{exists:false},
    },
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if (serverToken) headers.authorization=`Bearer ${serverToken}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if (!response.ok) {
    const detail=await response.text();
    if ([409,412].includes(response.status)||detail.includes("ALREADY_EXISTS")||detail.includes("FAILED_PRECONDITION"))
      return json(env,{error:"Equipe alterada durante a operação. Recarregue e tente novamente."},409);
    console.error("Professional create commit failed",response.status,detail.slice(0,200));
    return json(env,{error:"Não foi possível salvar profissional."},500);
  }
  return json(env,{professional:{id:professionalId,tenantId,name,serviceIds,active:true},auditId},201);
}

const TRANSITIONS: Record<string, readonly string[]> = {
  pending:["confirmed","cancelled"], confirmed:["in_service","cancelled","no_show"],
  in_service:["completed"], completed:[], cancelled:[], no_show:[],
};
async function updateAppointmentStatus(request:Request,env:Env):Promise<Response> {
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string" ? data.tenantId:"";
  const appointmentId=typeof data.appointmentId==="string" ? data.appointmentId:"";
  const nextStatus=typeof data.status==="string" ? data.status:"";
  if(![tenantId,appointmentId].every(x=>/^[A-Za-z0-9_-]{1,100}$/.test(x))||!Object.keys(TRANSITIONS).includes(nextStatus))
    return json(env,{error:"Identificadores ou status inválidos."},400);
  const bearer=request.headers.get("authorization") ?? "";
  if(!bearer.startsWith("Bearer ")) return json(env,{error:"Autenticação necessária."},401);
  let actorId:string;
  try{actorId=await verifyFirebaseIdToken(bearer.slice(7),env);}
  catch {return json(env,{error:"Sessão inválida."},401);}
  const token=env.FIRESTORE_EMULATOR_HOST ? "" : await serviceAccessToken(env);
  const [platform,membership,tenant,appointment]=await Promise.all([
    getDocument(env,token,`platformUsers/${actorId}`),
    getDocument(env,token,`memberships/${tenantId}_${actorId}`),
    getDocument(env,token,`tenants/${tenantId}`),
    getDocument(env,token,`tenants/${tenantId}/appointments/${appointmentId}`),
  ]);
  if(!tenant || !appointment || str(appointment,"tenantId")!==tenantId || !appointment.updateTime)
    return json(env,{error:"Agendamento não encontrado."},404);
  const platformAllowed=platform && str(platform,"role")==="platform_owner" && str(platform,"status")==="active";
  const role=membership && str(membership,"tenantId")===tenantId && str(membership,"userId")===actorId
    && str(membership,"status")==="active" ? str(membership,"role"):"";
  const allowed=platformAllowed || ["tenant_owner","tenant_admin"].includes(role)
    || (role==="professional" && str(membership!,"professionalId")===str(appointment,"professionalId"));
  if(!allowed) return json(env,{error:"Sem permissão para este atendimento."},403);
  const current=str(appointment,"status");
  if(!(TRANSITIONS[current] ?? []).includes(nextStatus))
    return json(env,{error:`Transição inválida: ${current} → ${nextStatus}.`},409);

  const writes:Array<Record<string,unknown>>=[];
  const now=new Date().toISOString();
  writes.push({
    update:{
      name:docName(env,`tenants/${tenantId}/appointments/${appointmentId}`),
      fields:fields({status:nextStatus,updatedAt:now}),
    },
    updateMask:{fieldPaths:["status","updatedAt"]},
    currentDocument:{updateTime:appointment.updateTime},
  });
  if(nextStatus==="cancelled"){
    const {dateKey,startMinute}=localParts(str(appointment,"startsAt"));
    const duration=int(appointment,"durationSnapshotMin");
    if(!Number.isInteger(duration)||duration<=0)return json(env,{error:"Duração histórica inválida."},409);
    const proId=str(appointment,"professionalId");
    const locks=await Promise.all(lockMinutes(startMinute,startMinute+duration).map(minute=>
      getDocument(env,token,`tenants/${tenantId}/bookingLocks/${proId}_${dateKey}_${minute}`)));
    if(locks.some(lock=>!lock || str(lock,"appointmentId")!==appointmentId))
      return json(env,{error:"Locks inconsistentes. Cancelamento requer revisão para evitar dupla agenda."},409);
    for(let i=0;i<locks.length;i++) {
      const minute=lockMinutes(startMinute,startMinute+duration)[i];
      writes.push({delete:docName(env,`tenants/${tenantId}/bookingLocks/${proId}_${dateKey}_${minute}`),
        currentDocument:{exists:true}});
    }
  }
  const auditId=crypto.randomUUID();
  writes.push({
    update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId,actorRole:platformAllowed?"platform_owner":role,
        action:"appointments.status_change",resourceType:"appointment",resourceId:appointmentId,
        before:{status:current},after:{status:nextStatus},createdAt:now})},
    currentDocument:{exists:false},
  });
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const detail=await response.text();
    if([409,412].includes(response.status)||detail.includes("FAILED_PRECONDITION"))
      return json(env,{error:"Agendamento alterado durante operação. Atualize a agenda."},409);
    console.error("Status change commit error",response.status,detail.slice(0,200));
    return json(env,{error:"Não foi possível alterar atendimento."},500);
  }
  return json(env,{ok:true,id:appointmentId,status:nextStatus,auditId});
}


/** Admin membership mutations are serialized with usage/staff CAS, preserving existing tenants. */
async function manageTenantAdmin(request:Request, env:Env):Promise<Response> {
  const payload = await request.json() as Record<string,unknown>;
  const tenantId = typeof payload.tenantId === "string" ? payload.tenantId : "";
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  const status = payload.status === "active" || payload.status === "disabled" ? payload.status : "";
  if (![tenantId,userId].every(id => /^[a-zA-Z0-9_-]{1,128}$/.test(id)) || !status)
    return json(env,{error:"Tenant, usuário ou status inválidos."},400);

  const token = env.FIRESTORE_EMULATOR_HOST ? "" : await serviceAccessToken(env);
  const actor = await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor || !["tenant_owner","platform_owner"].includes(actor.actorRole))
    return json(env,{error:"Apenas o proprietário pode administrar acessos."},403);

  const [tenant,existing] = await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    getDocument(env,token,`memberships/${tenantId}_${userId}`),
  ]);
  if(!tenant) return json(env,{error:"Tenant inexistente."},404);
  if(!existing && actor.actorRole!=="platform_owner")
    return json(env,{error:"Nova associação exige cadastro ou convite verificado pela plataforma."},403);
  if(existing && (str(existing,"tenantId")!==tenantId || str(existing,"userId")!==userId ||
      !["tenant_admin","professional","customer"].includes(str(existing,"role"))))
    return json(env,{error:"Membership não pode ser alterada por este fluxo."},403);
  if(userId===actor.actorId) return json(env,{error:"Não é permitido alterar o próprio acesso por este fluxo."},403);

  const previouslyActive = !!existing && str(existing,"role")==="tenant_admin" && str(existing,"status")==="active";
  const nextActive = status==="active";
  const delta = Number(nextActive)-Number(previouslyActive);
  const counterPath = `tenants/${tenantId}/usage/staff`;
  const counter = await getDocument(env,token,counterPath);
  const currentCount = counter && counter.fields?.tenantAdminsAdditional?.integerValue !== undefined
    ? int(counter,"tenantAdminsAdditional")
    : (await listDocuments(env,token,"memberships")).filter(item =>
        str(item,"tenantId")===tenantId && str(item,"role")==="tenant_admin" && str(item,"status")==="active").length;
  if(!Number.isSafeInteger(currentCount) || currentCount<0 || currentCount+delta<0)
    return json(env,{error:"Contador de administradores inconsistente."},409);
  const max = getLimit(asTenant(tenant,tenantId),"tenant_admins");
  if(delta>0 && (max===0 || (max!==null && currentCount+delta>max)))
    return json(env,{error:`Limite de administradores adicionais atingido (${currentCount}/${max}).`},409);

  const now = new Date().toISOString(), auditId = crypto.randomUUID();
  const member = {
    tenantId,userId,role:"tenant_admin",status,updatedAt:now,
  };
  const writes = [
    {
      update:{name:docName(env,`memberships/${tenantId}_${userId}`),fields:fields(member)},
      currentDocument: existing?.updateTime ? {updateTime:existing.updateTime} : {exists:false},
    },
    {
      update:{name:docName(env,counterPath),fields:fields({tenantAdminsAdditional:currentCount+delta,updatedAt:now})},
      updateMask:{fieldPaths:["tenantAdminsAdditional","updatedAt"]},
      currentDocument: counter?.updateTime ? {updateTime:counter.updateTime} : {exists:false},
    },
    {
      update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
        fields:fields({
          tenantId,actorId:actor.actorId,actorRole:actor.actorRole,action:"membership.tenant_admin",
          resourceType:"membership",resourceId:`${tenantId}_${userId}`,
          before:existing ? {role:str(existing,"role"),status:str(existing,"status")} : {},
          after:member,createdAt:now,
        })},
      currentDocument:{exists:false},
    },
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok) {
    const body=await response.text();
    if([409,412].includes(response.status) || /FAILED_PRECONDITION|ALREADY_EXISTS|ABORTED/.test(body))
      return json(env,{error:"Equipe alterada simultaneamente. Atualize e tente novamente."},409);
    console.error("Admin membership commit rejected",response.status,body.slice(0,200));
    return json(env,{error:"Não foi possível atualizar o administrador."},500);
  }
  return json(env,{ok:true,membership:member,auditId});
}


async function setProfessionalActive(request:Request,env:Env):Promise<Response> {
  const payload=await request.json() as Record<string,unknown>;
  const tenantId=typeof payload.tenantId==="string" ? payload.tenantId:"";
  const professionalId=typeof payload.professionalId==="string" ? payload.professionalId:"";
  const active=payload.active;
  if(![tenantId,professionalId].every(id=>/^[a-zA-Z0-9_-]{1,100}$/.test(id))||typeof active!=="boolean")
    return json(env,{error:"Identificadores ou estado inválidos."},400);
  const token=env.FIRESTORE_EMULATOR_HOST ? "" : await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor)return json(env,{error:"Acesso negado."},403);
  const [tenant,professional]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    getDocument(env,token,`tenants/${tenantId}/professionals/${professionalId}`),
  ]);
  if(!tenant||!professional||!professional.updateTime)
    return json(env,{error:"Profissional não encontrada."},404);
  const wasActive=bool(professional,"active");
  if(wasActive===active)return json(env,{ok:true,unchanged:true,professionalId,active});
  if(!active) {
    const nowLocal=zonedNowString(settings(tenant).timezone);
    const future=(await listDocuments(env,token,`tenants/${tenantId}/appointments`))
      .some(appointment=>
        str(appointment,"professionalId")===professionalId
        && ["pending","confirmed","in_service"].includes(str(appointment,"status"))
        && str(appointment,"startsAt")>=nowLocal);
    if(future)return json(env,{error:"Há atendimentos futuros ativos. Reatribua ou cancele-os antes de desativar."},409);
  }
  const counterPath=`tenants/${tenantId}/usage/staff`;
  const counter=await getDocument(env,token,counterPath);
  const count=counter?.fields?.professionalsActive?.integerValue!==undefined
    ? int(counter,"professionalsActive")
    : (await listDocuments(env,token,`tenants/${tenantId}/professionals`)).filter(p=>bool(p,"active")).length;
  const next=count+(active?1:-1);
  if(!Number.isSafeInteger(count)||count<0||next<0)return json(env,{error:"Contador inconsistente."},409);
  if(active) {
    const limit=getLimit(asTenant(tenant,tenantId),"professionals_active");
    if(limit===0 || (limit!==null && next>limit))
      return json(env,{error:`Limite de profissionais ativos atingido (${count}/${limit}).`},409);
  }
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const writes=[
    {
      update:{name:docName(env,`tenants/${tenantId}/professionals/${professionalId}`),
        fields:fields({active,updatedAt:now})},
      updateMask:{fieldPaths:["active","updatedAt"]},
      currentDocument:{updateTime:professional.updateTime},
    },
    {
      update:{name:docName(env,counterPath),fields:fields({professionalsActive:next,updatedAt:now})},
      updateMask:{fieldPaths:["professionalsActive","updatedAt"]},
      currentDocument:counter?.updateTime ? {updateTime:counter.updateTime} : {exists:false},
    },
    {
      update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
        fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,
          action:"professionals.active_changed",resourceType:"professional",resourceId:professionalId,
          before:{active:wasActive},after:{active},createdAt:now})},
      currentDocument:{exists:false},
    },
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok) {
    const detail=await response.text();
    if([409,412].includes(response.status)||/FAILED_PRECONDITION|ABORTED/.test(detail))
      return json(env,{error:"Equipe alterada simultaneamente. Recarregue e tente novamente."},409);
    console.error("Professional status write failed",response.status,detail.slice(0,200));
    return json(env,{error:"Não foi possível atualizar profissional."},500);
  }
  return json(env,{ok:true,professionalId,active,auditId});
}

async function rescheduleAppointment(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const appointmentId=typeof data.appointmentId==="string"?data.appointmentId:"";
  const startsAt=typeof data.startsAt==="string"?data.startsAt:"";
  if(![tenantId,appointmentId].every(value=>/^[A-Za-z0-9_-]{1,100}$/.test(value))||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(startsAt))
    return json(env,{error:"Parâmetros inválidos."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor)return json(env,{error:"Sem permissão para remarcar."},403);
  const [tenant,appointment]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    getDocument(env,token,`tenants/${tenantId}/appointments/${appointmentId}`),
  ]);
  if(!tenant||str(tenant,"status")!=="active"||!appointment||!appointment.updateTime||
    str(appointment,"tenantId")!==tenantId)return json(env,{error:"Agendamento não encontrado ou tenant suspenso."},404);
  if(!["pending","confirmed"].includes(str(appointment,"status")))
    return json(env,{error:"Somente pendente ou confirmado pode ser remarcado."},409);
  if(!evaluate(asTenant(tenant,tenantId),"booking.create").allowed)
    return json(env,{error:"Plano não permite reagendamento neste estado."},403);
  const serviceId=str(appointment,"serviceId"),professionalId=str(appointment,"professionalId");
  if(![serviceId,professionalId].every(value=>/^[A-Za-z0-9_-]{1,100}$/.test(value)))
    return json(env,{error:"Referência de serviço/profissional inválida."},409);
  const [service,professional]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}/services/${serviceId}`),
    getDocument(env,token,`tenants/${tenantId}/professionals/${professionalId}`),
  ]);
  if(!service||!professional||!bool(service,"active")||!bool(professional,"active"))
    return json(env,{error:"Serviço ou profissional indisponível."},409);
  const duration=int(appointment,"durationSnapshotMin");
  if(!Number.isSafeInteger(duration)||duration<15||duration>480)
    return json(env,{error:"Snapshot de duração inválido."},409);
  const oldStart=str(appointment,"startsAt");
  const old={...localParts(oldStart),duration};
  const next=localParts(startsAt),endMinute=next.startMinute+duration;
  const oldEnd=addMinutes(oldStart,duration),newEnd=addMinutes(startsAt,duration);
  if(oldStart===startsAt)return json(env,{error:"Selecione um horário diferente."},409);
  const availability=await availableSlots(env,token,tenantId,tenant,
    {...service,fields:{...service.fields,durationMin:{integerValue:String(duration)}}},
    professional,next.dateKey,appointmentId);
  if(!availability.includes(startsAt))
    return json(env,{error:"Novo horário indisponível."},409);
  const oldIds=lockMinutes(old.startMinute,old.startMinute+duration).map(minute=>`${professionalId}_${old.dateKey}_${minute}`);
  const newIds=lockMinutes(next.startMinute,endMinute).map(minute=>`${professionalId}_${next.dateKey}_${minute}`);
  const oldSet=new Set(oldIds),newSet=new Set(newIds);
  const verifyIds=oldIds;
  const held=await Promise.all(verifyIds.map(id=>getDocument(env,token,`tenants/${tenantId}/bookingLocks/${id}`)));
  if(held.some(lock=>!lock||str(lock,"appointmentId")!==appointmentId))
    return json(env,{error:"Inconsistência de locks da reserva original."},409);
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const writes:Array<Record<string,unknown>>=[
    {update:{name:docName(env,`tenants/${tenantId}/appointments/${appointmentId}`),
      fields:fields({startsAt,endsAt:newEnd,dateKey:next.dateKey,startMinute:next.startMinute,
        endMinute,updatedAt:now})},
      updateMask:{fieldPaths:["startsAt","endsAt","dateKey","startMinute","endMinute","updatedAt"]},
      currentDocument:{updateTime:appointment.updateTime}},
  ];
  for(const id of oldIds){
    if(newSet.has(id))continue;
    writes.push({delete:docName(env,`tenants/${tenantId}/bookingLocks/${id}`),
      currentDocument:{exists:true}});
  }
  for(const id of newIds){
    if(oldSet.has(id))continue;
    const minute=Number(id.split("_").pop());
    writes.push({update:{name:docName(env,`tenants/${tenantId}/bookingLocks/${id}`),
      fields:fields({tenantId,professionalId,appointmentId,dateKey:next.dateKey,minute,createdAt:now})},
      currentDocument:{exists:false}});
  }
  writes.push({update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
    fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,action:"appointments.reschedule",
      resourceType:"appointment",resourceId:appointmentId,before:{startsAt:oldStart,endsAt:oldEnd},
      after:{startsAt,endsAt:newEnd},createdAt:now})},currentDocument:{exists:false}});
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const detail=await response.text();
    if([409,412].includes(response.status)||/FAILED_PRECONDITION|ALREADY_EXISTS|ABORTED/.test(detail))
      return json(env,{error:"Horário alterado por outra reserva. Selecione outro."},409);
    console.error("Reschedule failed",response.status,detail.slice(0,200));
    return json(env,{error:"Não foi possível remarcar."},500);
  }
  return json(env,{ok:true,id:appointmentId,startsAt,endsAt:newEnd,auditId});
}

function validLocalDateTime(value:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(value))return false;
  const [date,time]=value.split("T");
  if(!validDate(date))return false;
  const [hour,minute]=time.split(":").map(Number);
  return hour>=0&&hour<24&&minute>=0&&minute<60;
}
async function manageBlock(request:Request,env:Env,action:"create"|"cancel"):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const professionalId=typeof data.professionalId==="string"?data.professionalId:"";
  const blockId=typeof data.blockId==="string"?data.blockId:"";
  if(![tenantId,professionalId].every(id=>/^[A-Za-z0-9_-]{1,100}$/.test(id))||
    (action==="cancel"&&!/^[A-Za-z0-9_-]{1,100}$/.test(blockId)))
    return json(env,{error:"Identificador inválido."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor)return json(env,{error:"Sem permissão para bloqueios de agenda."},403);
  const tenant=await getDocument(env,token,`tenants/${tenantId}`);
  if(!tenant||str(tenant,"status")!=="active")return json(env,{error:"Tenant indisponível."},404);
  const professional=await getDocument(env,token,`tenants/${tenantId}/professionals/${professionalId}`);
  if(!professional)return json(env,{error:"Profissional não pertence ao tenant."},404);
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const writes:Array<Record<string,unknown>>=[];
  let resourceId:string,actionName:string,before:Record<string,unknown>={},after:Record<string,unknown>={};
  if(action==="create"){
    const startsAt=typeof data.startsAt==="string"?data.startsAt:"";
    const endsAt=typeof data.endsAt==="string"?data.endsAt:"";
    const reason=typeof data.reason==="string"?data.reason.trim():"";
    const startMs=Date.parse(`${startsAt}Z`),endMs=Date.parse(`${endsAt}Z`);
    if(!validLocalDateTime(startsAt)||!validLocalDateTime(endsAt)||endsAt<=startsAt||
       !Number.isFinite(endMs-startMs)||endMs-startMs>30*86400_000||reason.length<3||reason.length>160)
      return json(env,{error:"Folga inválida (máx. 30 dias, com motivo de 3–160 caracteres)."},400);
    const appointments=await listDocuments(env,token,`tenants/${tenantId}/appointments`);
    if(appointments.some(appt=>str(appt,"professionalId")===professionalId &&
      ["pending","confirmed","in_service"].includes(str(appt,"status")) &&
      str(appt,"startsAt")<endsAt && str(appt,"endsAt")>startsAt))
      return json(env,{error:"Existe atendimento ativo nesse intervalo. Reagende ou cancele primeiro."},409);
    resourceId=crypto.randomUUID();
    actionName="schedule_blocks.create";
    after={tenantId,professionalId,startsAt,endsAt,reason,active:true,createdAt:now,updatedAt:now};
    writes.push({update:{name:docName(env,`tenants/${tenantId}/scheduleBlocks/${resourceId}`),
      fields:fields(after)},currentDocument:{exists:false}});
  }else{
    const block=await getDocument(env,token,`tenants/${tenantId}/scheduleBlocks/${blockId}`);
    if(!block||str(block,"professionalId")!==professionalId||!block.updateTime)
      return json(env,{error:"Bloqueio não encontrado."},404);
    if(block.fields?.active?.booleanValue===false)
      return json(env,{error:"Bloqueio já cancelado."},409);
    resourceId=blockId;actionName="schedule_blocks.cancel";
    before={active:true,startsAt:str(block,"startsAt"),endsAt:str(block,"endsAt")};
    after={active:false,updatedAt:now};
    writes.push({update:{name:docName(env,`tenants/${tenantId}/scheduleBlocks/${blockId}`),
      fields:fields(after)},updateMask:{fieldPaths:["active","updatedAt"]},
      currentDocument:{updateTime:block.updateTime}});
  }
  writes.push({update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
    fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,action:actionName,
      resourceType:"scheduleBlock",resourceId,before,after,createdAt:now})},currentDocument:{exists:false}});
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const error=await response.text();
    if([409,412].includes(response.status)||/FAILED_PRECONDITION|ABORTED/.test(error))
      return json(env,{error:"Agenda atualizada simultaneamente. Recarregue."},409);
    console.error("Schedule block mutation failed",response.status,error.slice(0,200));
    return json(env,{error:"Não foi possível alterar bloqueio."},500);
  }
  return json(env,{ok:true,blockId:resourceId,action,auditId},action==="create"?201:200);
}

/** Tenant branding is persistent business data, never a per-plan security gate. */
async function updateTenantBranding(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const name=typeof data.name==="string"?data.name.trim():"";
  const branding=typeof data.branding==="object"&&data.branding!==null&&!Array.isArray(data.branding)
    ? data.branding as Record<string,unknown>:null;
  const contact=typeof data.contact==="object"&&data.contact!==null&&!Array.isArray(data.contact)
    ? data.contact as Record<string,unknown>:null;
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId)||name.length<2||name.length>100||!branding||!contact)
    return json(env,{error:"Dados de branding inválidos."},400);
  const primary=typeof branding.primary==="string"?branding.primary:"";
  const accent=typeof branding.accent==="string"?branding.accent:"";
  const background=typeof branding.background==="string"?branding.background:"";
  const logoText=typeof branding.logoText==="string"?branding.logoText.trim():"";
  const whatsapp=typeof contact.whatsapp==="string"?contact.whatsapp.replace(/\D/g,""):"";
  const instagram=typeof contact.instagram==="string"?contact.instagram.trim().replace(/^@/,""):"";
  if(![primary,accent,background].every(v=>/^#[0-9a-fA-F]{6}$/.test(v))||
    logoText.length<1||logoText.length>5||!(whatsapp===""||whatsapp.length>=10&&whatsapp.length<=15)||
    !(instagram===""||/^[A-Za-z0-9._]{1,30}$/.test(instagram)))
    return json(env,{error:"Cores hexadecimais, logo ou contatos inválidos."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor || !["tenant_owner","platform_owner"].includes(actor.actorRole))
    return json(env,{error:"Somente proprietário pode atualizar identidade visual."},403);
  const tenant=await getDocument(env,token,`tenants/${tenantId}`);
  if(!tenant||!tenant.updateTime)return json(env,{error:"Tenant não encontrado."},404);
  const beforeBrand=asRecord(tenant.fields?.branding);
  const beforeContact=asRecord(tenant.fields?.contact);
  const before={name:str(tenant,"name"),branding:{
    primary:beforeBrand.primary?.stringValue??"",accent:beforeBrand.accent?.stringValue??"",
    background:beforeBrand.background?.stringValue??"",logoText:beforeBrand.logoText?.stringValue??"",
  },contact:{whatsapp:beforeContact.whatsapp?.stringValue??"",instagram:beforeContact.instagram?.stringValue??""}};
  const after={name,branding:{primary,accent,background,logoText},contact:{whatsapp,instagram}};
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const writes=[
    {update:{name:docName(env,`tenants/${tenantId}`),fields:fields(after)},
      updateMask:{fieldPaths:["name","branding","contact"]},
      currentDocument:{updateTime:tenant.updateTime}},
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,action:"tenant.branding_update",
        resourceType:"tenant",resourceId:tenantId,before,after,createdAt:now})},currentDocument:{exists:false}},
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const detail=await response.text();
    if([409,412].includes(response.status)||/FAILED_PRECONDITION|ABORTED/.test(detail))
      return json(env,{error:"Configurações alteradas simultaneamente. Recarregue."},409);
    console.error("Brand update failed",response.status,detail.slice(0,200));
    return json(env,{error:"Falha ao salvar branding."},500);
  }
  return json(env,{ok:true,branding:after,auditId});
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    if (request.method === "GET" && url.pathname === "/health") return json(env, { ok: true, service: "saas-manicure-booking-api" });
    if (request.method === "GET" && url.pathname === "/api/availability") {
      try {return await lookupAvailability(request,env);}
      catch(error) {console.error("Availability failed",error);return json(env,{error:"Disponibilidade indisponível."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/admin/appointments/reschedule"){
      try{return await rescheduleAppointment(request,env);}
      catch(error){console.error("Reschedule failure",error);return json(env,{error:"Erro ao remarcar."},500);}
    }
    if (request.method === "POST" && url.pathname === "/api/admin/appointments/status") {
      try {return await updateAppointmentStatus(request,env);}
      catch(error){console.error("Status change failure",error);return json(env,{error:"Falha ao alterar agendamento."},500);}
    }
    if (request.method === "POST" && url.pathname === "/api/admin/memberships/tenant-admin") {
      try { return await manageTenantAdmin(request,env); }
      catch(error) { console.error("Membership update failure",error); return json(env,{error:"Falha ao alterar administrador."},500); }
    }
    if(request.method==="POST" && url.pathname==="/api/admin/tenants/branding"){
      try{return await updateTenantBranding(request,env);}
      catch(error){console.error("Brand update failure",error);return json(env,{error:"Erro ao atualizar identidade visual."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/admin/schedule-blocks/create"){
      try{return await manageBlock(request,env,"create");}
      catch(error){console.error("Block creation failed",error);return json(env,{error:"Falha ao criar bloqueio."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/admin/schedule-blocks/cancel"){
      try{return await manageBlock(request,env,"cancel");}
      catch(error){console.error("Block cancellation failed",error);return json(env,{error:"Falha ao cancelar bloqueio."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/admin/professionals/schedule"){
      try{return await configureProfessionalHours(request,env);}
      catch(error){console.error("Schedule operation failed",error);return json(env,{error:"Erro ao configurar agenda."},500);}
    }
    if (request.method === "POST" && url.pathname === "/api/admin/professionals/activation") {
      try {return await setProfessionalActive(request,env);}
      catch(error){console.error("Professional active update failed",error);return json(env,{error:"Falha ao atualizar profissional."},500);}
    }
    if (request.method === "POST" && url.pathname === "/api/admin/professionals") {
      try { return await createProfessional(request,env); }
      catch(error) {console.error("Professional create failed",error);return json(env,{error:"Falha ao cadastrar profissional."},500);}
    }
    if (request.method === "POST" && url.pathname === "/api/admin/plans/assign") {
      try { return await assignPlan(request, env); }
      catch (error) { console.error("Plan assignment failed", error); return json(env,{error:"Falha ao atribuir plano."},500); }
    }
    if (request.method === "POST" && url.pathname === "/api/bookings") {
      try { return await createBooking(request, env); }
      catch (error) { console.error(error); return json(env, { error: error instanceof Error ? error.message : "Erro interno." }, 500); }
    }
    return json(env, { error: "Not found" }, 404);
  },
};
