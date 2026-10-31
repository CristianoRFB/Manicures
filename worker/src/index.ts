import { assertCommercialChange, evaluate, getLimit, type CommercialState } from "../../src/commercial/entitlements";
import type { Tenant } from "../../src/domain/types";
import {getStoredObject,deleteStoredGeneration,listStoredObjects,summarizeStoragePage,scanStoragePrefix} from "./mediaStorage";

interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  ALLOWED_ORIGIN?: string;
  FIREBASE_AUTH_PROJECT_ID?: string;
  FIRESTORE_EMULATOR_HOST?: string;
  FIREBASE_AUTH_EMULATOR_HOST?: string;
  FIREBASE_STORAGE_BUCKET?: string;
  FIREBASE_STORAGE_EMULATOR_HOST?: string;
  MEDIA_DELETION_ENABLED?: string;
}

type FireValue = { stringValue?: string; integerValue?: string; booleanValue?: boolean; mapValue?: { fields: Record<string, FireValue> }; arrayValue?: { values: FireValue[] } };
type FireDoc = { name: string; fields?: Record<string, FireValue>; updateTime?: string };

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
/** Appointment, customer, invitation and export responses must never be stored in shared caches. */
const PRIVATE_HTTP_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  "pragma": "no-cache",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "vary": "Origin",
};

function allowedOrigin(env: Env): string | null {
  const candidate = env.ALLOWED_ORIGIN?.trim();
  if (!candidate || candidate === "*" || candidate.includes(",")) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.origin !== candidate || parsed.username || parsed.password || parsed.pathname !== "/" ||
        parsed.search || parsed.hash) return null;
    if (parsed.protocol === "https:") return candidate;
    // HTTP is allowed only for the explicitly isolated local Firebase emulators.
    const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    const localEmulator = env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8080" &&
      ["manicure-demo", "manicure-worker-test"].includes(env.FIREBASE_PROJECT_ID);
    return parsed.protocol === "http:" && localHost && localEmulator ? candidate : null;
  } catch {
    return null;
  }
}
function cors(env: Env) {
  return {
    "access-control-allow-origin": allowedOrigin(env) ?? "",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
}
function validateRequestOrigin(request: Request, env: Env): Response | null {
  const allowed = allowedOrigin(env);
  if (!allowed) return new Response(JSON.stringify({error:"Origem do frontend não configurada com segurança."}),
    {status:503,headers:{...JSON_HEADERS,...PRIVATE_HTTP_HEADERS}});
  const incoming = request.headers.get("origin");
  if (incoming !== null && incoming !== allowed)
    return new Response(JSON.stringify({error:"Origem não permitida."}),
      {status:403,headers:{...JSON_HEADERS,...PRIVATE_HTTP_HEADERS}});
  return null;
}

function json(env: Env, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...PRIVATE_HTTP_HEADERS, ...cors(env) } });
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

async function serviceAccessToken(env: Env, scope="https://www.googleapis.com/auth/datastore"): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope,
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
  const allAppointments=await queryScopedDocuments(env,token,tenantId,"appointments",[
    {field:"professionalId",op:"EQUAL",value:professionalId},
    {field:"startsAt",op:"GREATER_THAN_OR_EQUAL",value:`${dateToday}T00:00:00`},
  ]);
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

/** Restricted server-side query: only the selected tenant collection and necessary
 * professional/date rows. Historical locks must not be scanned on every availability request.
 */
async function queryScopedDocuments(
  env:Env,token:string,tenantId:string,collectionId:"bookingLocks"|"scheduleBlocks"|"appointments",
  conditions:Array<{field:string;op:"EQUAL"|"LESS_THAN"|"GREATER_THAN"|"GREATER_THAN_OR_EQUAL";value:string}>,
):Promise<FireDoc[]> {
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(`${base(env)}/tenants/${tenantId}:runQuery`,{
    method:"POST",headers,body:JSON.stringify({structuredQuery:{
      from:[{collectionId}],
      where:{compositeFilter:{op:"AND",filters:conditions.map(item=>({
        fieldFilter:{field:{fieldPath:item.field},op:item.op,value:{stringValue:item.value}},
      }))}},
      limit:10001,
    }}),
  });
  if(!response.ok)throw new Error(`Firestore availability query failed (${response.status}).`);
  const entries=await response.json() as Array<{document?:FireDoc}>;
  if(!Array.isArray(entries))throw new Error("Resposta inesperada da consulta de disponibilidade.");
  const rows=entries.flatMap(entry=>entry.document?[entry.document]:[]);
  if(rows.length>10000)throw new Error("Limite de verificação de disponibilidade excedido.");
  return rows;
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
  // A block may start on a previous day and still overlap this date.
  // Use lexical ISO-local boundaries matching the persisted startsAt/endsAt format.
  const nextDate=new Date(Date.parse(`${date}T12:00:00Z`)+86400_000).toISOString().slice(0,10);
  const [locks,blocks]=await Promise.all([
    queryScopedDocuments(env,token,tenantId,"bookingLocks",[
      {field:"professionalId",op:"EQUAL",value:proId},
      {field:"dateKey",op:"EQUAL",value:date},
    ]),
    queryScopedDocuments(env,token,tenantId,"scheduleBlocks",[
      {field:"professionalId",op:"EQUAL",value:proId},
      {field:"startsAt",op:"LESS_THAN",value:`${nextDate}T00:00:00`},
      {field:"endsAt",op:"GREATER_THAN",value:`${date}T00:00:00`},
    ]),
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
  let authenticatedCustomerId:string|undefined;
  // A bearer token is optional for guest booking but, when supplied, it must be valid
  // and belong to an explicitly enrolled customer of this exact tenant.
  const bearer=request.headers.get("authorization");
  if(bearer){
    authenticatedCustomerId=await verifiedCustomerIdentity(request,env)??undefined;
    if(!authenticatedCustomerId)return json(env,{error:"Sessão de cliente inválida ou e-mail não confirmado."},401);
    if(!await customerMembership(env,token,tenantId,authenticatedCustomerId))
      return json(env,{error:"Perfil de cliente não vinculado a este studio."},403);
  }
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
        fields: fields({ appointmentId, tenantId, ...(authenticatedCustomerId?{customerId:authenticatedCustomerId}:{}), customerName, customerPhone:phoneDigits, professionalId, serviceId, startsAt, endsAt, dateKey, startMinute, endMinute, priceSnapshotCents: price, durationSnapshotMin: duration, status: "pending", createdAt: now, updatedAt: now }),
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

  return json(env, { appointment: { id: appointmentId, tenantId, ...(authenticatedCustomerId?{customerId:authenticatedCustomerId}:{}), customerName, customerPhone:phoneDigits, professionalId, serviceId, startsAt, endsAt, priceSnapshotCents: price, durationSnapshotMin: duration, status: "pending", createdAt: now, updatedAt: now } }, 201);
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
  // Idempotent edits may change overrides or notes, but must NEVER silently
  // extend an already running (or expired) 14-day trial.
  const trialUntil = status === "trial"
    ? (previous?.subscriptionStatus === "trial" ? previous.trialUntil ?? null
      : new Date(now.getTime() + 14*24*60*60*1000).toISOString())
    : null;
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
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(actorId))return null;
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
  if(nextStatus==="no_show" && str(appointment,"startsAt")>zonedNowString(settings(tenant).timezone))
    return json(env,{error:"Não é possível marcar ausência antes do início do horário."},409);

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
      str(existing,"role")!=="tenant_admin"))
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
    const future=(await queryScopedDocuments(env,token,tenantId,"appointments",[
      {field:"professionalId",op:"EQUAL",value:professionalId},
      {field:"startsAt",op:"GREATER_THAN_OR_EQUAL",value:nowLocal},
    ])).some(appointment=>
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
    const appointments=await queryScopedDocuments(env,token,tenantId,"appointments",[
      {field:"professionalId",op:"EQUAL",value:professionalId},
      {field:"startsAt",op:"LESS_THAN",value:endsAt},
      {field:"endsAt",op:"GREATER_THAN",value:startsAt},
    ]);
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

function csvCell(value:string):string{
  // Formula injection mitigation applies after optional whitespace too.
  const safe=/^[\s]*[=+@\-]/.test(value)?"'"+value:value;
  return '"'+safe.replace(/"/g,'""')+'"';
}
async function exportTenantAppointments(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as {tenantId?:unknown};
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId))return json(env,{error:"Tenant inválido."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor)return json(env,{error:"Sem permissão para exportação."},403);
  if(!await getDocument(env,token,`tenants/${tenantId}`))
    return json(env,{error:"Tenant não encontrado."},404);
  const appointments=await listDocuments(env,token,`tenants/${tenantId}/appointments`);
  if(appointments.length>10000)return json(env,{error:"Exportação exige paginação especial acima de 10000 registros."},413);
  const keys=["id","startsAt","endsAt","status","serviceId","professionalId",
    "customerName","customerPhone","priceSnapshotCents","durationSnapshotMin"];
  const rows=appointments.map(doc=>keys.map(key=>{
    if(key==="id")return doc.name.split("/").pop()??"";
    if(["priceSnapshotCents","durationSnapshotMin"].includes(key))return String(int(doc,key));
    return str(doc,key);
  }).map(csvCell).join(","));
  const csv="\uFEFF"+keys.join(",")+"\r\n"+rows.join("\r\n")+"\r\n";
  const auditId=crypto.randomUUID(),now=new Date().toISOString();
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const audit=await fetch(commitUrl(env),{method:"POST",headers,
    body:JSON.stringify({writes:[{update:{
      name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,
        action:"appointments.export_csv",resourceType:"appointments",resourceId:"export",
        recordCount:appointments.length,createdAt:now}),
    },currentDocument:{exists:false}}]})});
  if(!audit.ok)return json(env,{error:"Não foi possível auditar exportação; arquivo não foi entregue."},500);
  return new Response(csv,{status:200,headers:{...PRIVATE_HTTP_HEADERS,...cors(env),
    "content-type":"text/csv; charset=utf-8",
    "content-disposition":`attachment; filename="manicure-${tenantId}-appointments.csv"`,
    "cache-control":"no-store",
  }});
}

async function editProfessional(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const professionalId=typeof data.professionalId==="string"?data.professionalId:"";
  const name=typeof data.name==="string"?data.name.trim():"";
  const serviceIds=Array.isArray(data.serviceIds)&&data.serviceIds.every(id=>typeof id==="string")
    ? data.serviceIds as string[] : [];
  if(![tenantId,professionalId].every(id=>/^[A-Za-z0-9_-]{1,100}$/.test(id))||
    name.length<2||name.length>100||serviceIds.length>40||
    serviceIds.some(id=>!/^[A-Za-z0-9_-]{1,100}$/.test(id))||
    new Set(serviceIds).size!==serviceIds.length)
    return json(env,{error:"Dados de profissional inválidos."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor)return json(env,{error:"Sem permissão para editar profissional."},403);
  const [tenant,pro]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    getDocument(env,token,`tenants/${tenantId}/professionals/${professionalId}`),
  ]);
  if(!tenant||str(tenant,"status")!=="active"||!pro||!pro.updateTime)
    return json(env,{error:"Profissional não encontrada."},404);
  const services=await Promise.all(serviceIds.map(id=>getDocument(env,token,`tenants/${tenantId}/services/${id}`)));
  if(services.some(service=>!service||!bool(service,"active")))
    return json(env,{error:"Serviços inválidos, inativos ou de outro tenant."},400);
  const previous=arr(pro,"serviceIds"),removed=previous.filter(id=>!serviceIds.includes(id));
  if(removed.length){
    const nowLocal=zonedNowString(settings(tenant).timezone);
    const upcoming=(await queryScopedDocuments(env,token,tenantId,"appointments",[
      {field:"professionalId",op:"EQUAL",value:professionalId},
      {field:"startsAt",op:"GREATER_THAN_OR_EQUAL",value:nowLocal},
    ])).some(appointment=>str(appointment,"professionalId")===professionalId
        && removed.includes(str(appointment,"serviceId"))
        && ["pending","confirmed","in_service"].includes(str(appointment,"status"))
        && str(appointment,"startsAt")>=nowLocal);
    if(upcoming)return json(env,{error:"Há atendimento futuro para um serviço removido. Reagende ou cancele antes."},409);
  }
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const updates={name,serviceIds,updatedAt:now};
  const writes=[
    {update:{name:docName(env,`tenants/${tenantId}/professionals/${professionalId}`),
      fields:fields(updates)},updateMask:{fieldPaths:["name","serviceIds","updatedAt"]},
      currentDocument:{updateTime:pro.updateTime}},
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,
        action:"professionals.edit",resourceType:"professional",resourceId:professionalId,
        before:{name:str(pro,"name"),serviceIds:previous},after:updates,createdAt:now})},
      currentDocument:{exists:false}},
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const detail=await response.text();
    if([409,412].includes(response.status)||/FAILED_PRECONDITION|ABORTED/.test(detail))
      return json(env,{error:"Equipe alterada simultaneamente. Recarregue."},409);
    console.error("Professional edit failed",response.status,detail.slice(0,200));
    return json(env,{error:"Não foi possível editar profissional."},500);
  }
  return json(env,{ok:true,professionalId,name,serviceIds,auditId});
}


/** Never trust a caller-supplied customerId or a typed phone number as ownership proof. */
async function verifiedCustomerIdentity(request:Request,env:Env):Promise<string|null>{
  const authorization=request.headers.get("authorization")??"";
  if(!authorization.startsWith("Bearer "))return null;
  const raw=authorization.slice(7);
  let uid:string;
  try{uid=await verifyFirebaseIdToken(raw,env);}
  catch{return null;}
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(uid))return null;
  try{
    const payload=JSON.parse(new TextDecoder().decode(parseBase64Url(raw.split(".")[1]))) as {email_verified?:boolean};
    return payload.email_verified===true ? uid : null;
  }catch{return null;}
}
async function customerMembership(env:Env,token:string,tenantId:string,uid:string):Promise<FireDoc|null>{
  const membership=await getDocument(env,token,`memberships/${tenantId}_${uid}`);
  if(!membership || str(membership,"tenantId")!==tenantId || str(membership,"userId")!==uid ||
    str(membership,"role")!=="customer" || str(membership,"status")!=="active" ||
    str(membership,"customerId")!==uid)return null;
  return membership;
}
async function enrollCustomer(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId))return json(env,{error:"Tenant inválido."},400);
  const uid=await verifiedCustomerIdentity(request,env);
  if(!uid)return json(env,{error:"Faça login com e-mail confirmado antes de criar o perfil."},401);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const [tenant,existing]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    getDocument(env,token,`memberships/${tenantId}_${uid}`),
  ]);
  if(!tenant || str(tenant,"status")!=="active")return json(env,{error:"Studio indisponível."},404);
  if(existing){
    if(await customerMembership(env,token,tenantId,uid))
      return json(env,{ok:true,customerId:uid,alreadyEnrolled:true});
    return json(env,{error:"A conta já possui um vínculo diferente ou desativado neste studio."},409);
  }
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const member={tenantId,userId:uid,role:"customer",status:"active",customerId:uid,createdAt:now};
  const profile={tenantId,userId:uid,createdAt:now};
  const writes=[
    {update:{name:docName(env,`memberships/${tenantId}_${uid}`),fields:fields(member)},currentDocument:{exists:false}},
    {update:{name:docName(env,`tenants/${tenantId}/customers/${uid}`),fields:fields(profile)},currentDocument:{exists:false}},
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:uid,actorRole:"customer",action:"customer.self_enroll",
        resourceType:"customer",resourceId:uid,createdAt:now})},currentDocument:{exists:false}},
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const detail=await response.text();
    if([409,412].includes(response.status)||/ALREADY_EXISTS|FAILED_PRECONDITION|ABORTED/.test(detail))
      return json(env,{error:"Vínculo já criado; recarregue o perfil."},409);
    console.error("Customer enrollment failed",response.status,detail.slice(0,180));
    return json(env,{error:"Não foi possível cadastrar o cliente."},500);
  }
  return json(env,{ok:true,customerId:uid},201);
}
async function cancelCustomerAppointment(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const appointmentId=typeof data.appointmentId==="string"?data.appointmentId:"";
  if(![tenantId,appointmentId].every(id=>/^[A-Za-z0-9_-]{1,100}$/.test(id)))
    return json(env,{error:"Parâmetros inválidos."},400);
  const uid=await verifiedCustomerIdentity(request,env);
  if(!uid)return json(env,{error:"Autenticação confirmada necessária."},401);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const [tenant,member,appointment]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    customerMembership(env,token,tenantId,uid),
    getDocument(env,token,`tenants/${tenantId}/appointments/${appointmentId}`),
  ]);
  if(!tenant || str(tenant,"status")!=="active" || !member)
    return json(env,{error:"Sem acesso a este studio."},403);
  if(!appointment || str(appointment,"tenantId")!==tenantId ||
    str(appointment,"customerId")!==uid || !appointment.updateTime)
    return json(env,{error:"Agendamento não encontrado."},404);
  if(!["pending","confirmed"].includes(str(appointment,"status")))
    return json(env,{error:"Este atendimento não pode mais ser cancelado pelo cliente."},409);
  const startsAt=str(appointment,"startsAt"),duration=int(appointment,"durationSnapshotMin");
  if(!Number.isSafeInteger(duration)||duration<15||duration>480)return json(env,{error:"Duração histórica inválida."},409);
  if(startsAt<=zonedNowString(settings(tenant).timezone))
    return json(env,{error:"Horário já iniciado. Entre em contato com o studio."},409);
  const {dateKey,startMinute}=localParts(startsAt);
  const professionalId=str(appointment,"professionalId");
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(professionalId))
    return json(env,{error:"Identificador histórico inválido."},409);
  const lockIds=lockMinutes(startMinute,startMinute+duration).map(minute=>`${professionalId}_${dateKey}_${minute}`);
  const existing=await Promise.all(lockIds.map(id=>getDocument(env,token,`tenants/${tenantId}/bookingLocks/${id}`)));
  if(existing.some(lock=>!lock||str(lock,"appointmentId")!==appointmentId))
    return json(env,{error:"Agenda inconsistente; entre em contato com o studio."},409);
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const writes:Array<Record<string,unknown>>=[
    {update:{name:docName(env,`tenants/${tenantId}/appointments/${appointmentId}`),
      fields:fields({status:"cancelled",updatedAt:now})},
      updateMask:{fieldPaths:["status","updatedAt"]},currentDocument:{updateTime:appointment.updateTime}},
    ...lockIds.map(id=>({delete:docName(env,`tenants/${tenantId}/bookingLocks/${id}`),currentDocument:{exists:true}})),
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:uid,actorRole:"customer",action:"appointments.customer_cancel",
        resourceType:"appointment",resourceId:appointmentId,createdAt:now,
        before:{status:str(appointment,"status")},after:{status:"cancelled"}})},currentDocument:{exists:false}},
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const detail=await response.text();
    if([409,412].includes(response.status)||/FAILED_PRECONDITION|ALREADY_EXISTS|ABORTED/.test(detail))
      return json(env,{error:"Reserva modificada simultaneamente. Atualize a página."},409);
    console.error("Customer cancellation failed",response.status,detail.slice(0,180));
    return json(env,{error:"Falha ao cancelar reserva."},500);
  }
  return json(env,{ok:true,appointmentId,status:"cancelled"});
}


/** A phone match and knowledge of booking ID never prove ownership. */
async function requestGuestHistoryLink(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const appointmentId=typeof data.appointmentId==="string"?data.appointmentId:"";
  const phone=typeof data.bookingPhone==="string"?data.bookingPhone.replace(/\D/g,""):"";
  if(![tenantId,appointmentId].every(v=>/^[A-Za-z0-9_-]{1,100}$/.test(v))||!/^[0-9]{10,15}$/.test(phone))
    return json(env,{error:"Informe protocolo e telefone originais válidos."},400);
  const uid=await verifiedCustomerIdentity(request,env);
  if(!uid)return json(env,{error:"E-mail confirmado necessário."},401);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const [tenant,member,appointment]=await Promise.all([
    getDocument(env,token,"tenants/"+tenantId),
    customerMembership(env,token,tenantId,uid),
    getDocument(env,token,"tenants/"+tenantId+"/appointments/"+appointmentId),
  ]);
  if(!tenant||str(tenant,"status")!=="active"||!member)
    return json(env,{error:"Perfil de cliente indisponível neste studio."},403);
  const generic={ok:true,message:"Se os dados conferirem, o studio poderá analisar após validar sua identidade por outro canal."};
  if(!appointment||str(appointment,"tenantId")!==tenantId||str(appointment,"customerId")||
    str(appointment,"customerPhone").replace(/\D/g,"")!==phone)return json(env,generic,202);
  const id=appointmentId+"_"+uid,path="tenants/"+tenantId+"/guestClaims/"+id;
  if(await getDocument(env,token,path))return json(env,generic,202);
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const writes=[
    {update:{name:docName(env,path),fields:fields({tenantId,appointmentId,
      customerId:uid,status:"pending_review",createdAt:now})},currentDocument:{exists:false}},
    {update:{name:docName(env,"tenants/"+tenantId+"/auditLogs/"+auditId),
      fields:fields({tenantId,actorId:uid,actorRole:"customer",action:"guest_claim.request",
        resourceType:"guestClaim",resourceId:id,createdAt:now})},currentDocument:{exists:false}},
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization="Bearer "+token;
  const result=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!result.ok){
    const body=await result.text();
    if([409,412].includes(result.status)||/ALREADY_EXISTS|FAILED_PRECONDITION/.test(body))
      return json(env,generic,202);
    throw new Error("Falha ao registrar pedido de histórico.");
  }
  return json(env,generic,202);
}
async function listGuestHistoryLinks(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId))return json(env,{error:"Tenant inválido."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor)return json(env,{error:"Sem permissão."},403);
  const rows=await listDocuments(env,token,"tenants/"+tenantId+"/guestClaims");
  return json(env,{claims:rows.slice(-250).map(item=>({
    claimId:item.name.split("/").pop(),appointmentId:str(item,"appointmentId"),
    customerId:str(item,"customerId"),status:str(item,"status"),
    createdAt:str(item,"createdAt"),reviewedAt:str(item,"reviewedAt"),
  })).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
}
async function reviewGuestHistoryLink(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const claimId=typeof data.claimId==="string"?data.claimId:"";
  const decision=data.decision==="approve"||data.decision==="reject"?data.decision:"";
  const reason=typeof data.reason==="string"?data.reason.trim():"";
  const method=data.verificationMethod==="in_person"||
    data.verificationMethod==="independent_callback"?data.verificationMethod:"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId)||!/^[A-Za-z0-9_-]{3,201}$/.test(claimId)||
    !decision||reason.length<10||reason.length>500||
    (decision==="approve"&&(data.identityVerifiedOffline!==true||!method)))
    return json(env,{error:"Revisão requer justificativa e verificação independente na aprovação."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor)return json(env,{error:"Somente gestão do studio pode revisar."},403);
  const path="tenants/"+tenantId+"/guestClaims/"+claimId;
  const claim=await getDocument(env,token,path);
  if(!claim||!claim.updateTime||str(claim,"tenantId")!==tenantId||
    str(claim,"status")!=="pending_review")return json(env,{error:"Pedido inexistente ou já revisado."},409);
  const appointmentId=str(claim,"appointmentId"),customerId=str(claim,"customerId");
  if(![appointmentId,customerId].every(v=>/^[A-Za-z0-9_-]{1,100}$/.test(v))||
    claimId!==appointmentId+"_"+customerId)return json(env,{error:"Pedido inconsistente."},409);
  const [member,appointment]=await Promise.all([
    customerMembership(env,token,tenantId,customerId),
    getDocument(env,token,"tenants/"+tenantId+"/appointments/"+appointmentId),
  ]);
  if(decision==="approve"&&(!member||!appointment||!appointment.updateTime||
    str(appointment,"tenantId")!==tenantId||str(appointment,"customerId")))
    return json(env,{error:"Agendamento vinculado ou cliente indisponível."},409);
  const now=new Date().toISOString(),status=decision==="approve"?"approved":"rejected",auditId=crypto.randomUUID();
  const writes:Array<Record<string,unknown>>=[
    {update:{name:docName(env,path),fields:fields({status,reviewedBy:actor.actorId,
      reviewReason:reason,reviewedAt:now,verificationMethod:method||"not_applicable"})},
      updateMask:{fieldPaths:["status","reviewedBy","reviewReason","reviewedAt","verificationMethod"]},
      currentDocument:{updateTime:claim.updateTime}},
    {update:{name:docName(env,"tenants/"+tenantId+"/auditLogs/"+auditId),
      fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,
        action:"guest_claim.review",resourceType:"guestClaim",resourceId:claimId,
        createdAt:now,reason,before:{status:"pending_review"},after:{status,appointmentId,
          customerId,verificationMethod:method}})},currentDocument:{exists:false}},
  ];
  if(decision==="approve")writes.push({
    update:{name:docName(env,"tenants/"+tenantId+"/appointments/"+appointmentId),
      fields:fields({customerId,updatedAt:now})},
    updateMask:{fieldPaths:["customerId","updatedAt"]},
    currentDocument:{updateTime:appointment!.updateTime},
  });
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization="Bearer "+token;
  const result=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!result.ok){
    const body=await result.text();
    if([409,412].includes(result.status)||/FAILED_PRECONDITION|ABORTED/.test(body))
      return json(env,{error:"Pedido ou reserva alterado simultaneamente."},409);
    throw new Error("Falha ao revisar pedido de histórico.");
  }
  return json(env,{ok:true,status,claimId,appointmentId});
}

async function tenantQuotaOverview(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId))
    return json(env,{error:"Tenant inválido."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor)return json(env,{error:"Sem permissão para visualizar quotas."},403);
  const [tenant,counter]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    getDocument(env,token,`tenants/${tenantId}/usage/staff`),
  ]);
  if(!tenant)return json(env,{error:"Tenant não encontrado."},404);
  const [pros,admins]=await Promise.all([
    counter?.fields?.professionalsActive?.integerValue !== undefined
      ? Promise.resolve(int(counter,"professionalsActive"))
      : listDocuments(env,token,`tenants/${tenantId}/professionals`).then(rows=>rows.filter(row=>bool(row,"active")).length),
    counter?.fields?.tenantAdminsAdditional?.integerValue !== undefined
      ? Promise.resolve(int(counter,"tenantAdminsAdditional"))
      : listDocuments(env,token,"memberships").then(rows=>rows.filter(row=>
        str(row,"tenantId")===tenantId && str(row,"role")==="tenant_admin" &&
        str(row,"status")==="active").length),
  ]);
  if(![pros,admins].every(x=>Number.isSafeInteger(x)&&x>=0))
    return json(env,{error:"Contadores de equipe inconsistentes."},409);
  const limits={professionals_active:getLimit(asTenant(tenant,tenantId),"professionals_active"),
    tenant_admins:getLimit(asTenant(tenant,tenantId),"tenant_admins")};
  const exceeded={professionals_active:limits.professionals_active!==null&&pros>limits.professionals_active,
    tenant_admins:limits.tenant_admins!==null&&admins>limits.tenant_admins};
  return json(env,{tenantId,usage:{professionals_active:pros,tenant_admins:admins},
    limits,exceeded,subscriptionStatus:parseCommercial(tenant)?.subscriptionStatus??"legacy"});
}


/** Staff invitation is a tenant-scoped, expiring, one-use document, NOT an Auth user. */
function inviteIdentity(request:Request,env:Env):Promise<{uid:string;email:string}|null>{
  return (async()=>{
    const authorization=request.headers.get("authorization")??"";
    if(!authorization.startsWith("Bearer "))return null;
    const raw=authorization.slice(7);
    let uid:string;
    try{uid=await verifyFirebaseIdToken(raw,env);}
    catch{return null;}
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(uid))return null;
    try{
      const claims=JSON.parse(new TextDecoder().decode(parseBase64Url(raw.split(".")[1]))) as {
        email?:string;email_verified?:boolean;
      };
      const email=typeof claims.email==="string"?claims.email.trim().toLowerCase():"";
      if(claims.email_verified!==true || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254)
        return null;
      return {uid,email};
    }catch{return null;}
  })();
}
async function issueStaffInvitation(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const email=typeof data.email==="string"?data.email.trim().toLowerCase():"";
  const role=data.role==="tenant_admin"||data.role==="professional"?data.role:"";
  const professionalId=typeof data.professionalId==="string"?data.professionalId:"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !role ||
    (role==="professional" && !/^[A-Za-z0-9_-]{1,100}$/.test(professionalId)) ||
    (role!=="professional"&&professionalId))
    return json(env,{error:"Tenant, e-mail ou papel do convite inválido."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor||!["tenant_owner","platform_owner"].includes(actor.actorRole))
    return json(env,{error:"Somente proprietário pode emitir convites."},403);
  const [tenant,professional]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    role==="professional"?getDocument(env,token,`tenants/${tenantId}/professionals/${professionalId}`):Promise.resolve(null),
  ]);
  if(!tenant||str(tenant,"status")!=="active")return json(env,{error:"Tenant indisponível."},404);
  if(role==="professional"&&(!professional||str(professional,"tenantId")!==tenantId||!bool(professional,"active")))
    return json(env,{error:"Profissional não encontrada ou inativa."},400);
  if(role==="tenant_admin" && getLimit(asTenant(tenant,tenantId),"tenant_admins")===0)
    return json(env,{error:"O plano atual não permite administradores adicionais."},409);
  const invitationId=crypto.randomUUID(),auditId=crypto.randomUUID();
  const now=new Date().toISOString(),expiresAtEpochMs=Date.now()+48*60*60*1000;
  const invitation={tenantId,email,role,professionalId:role==="professional"?professionalId:"",
    status:"pending",expiresAtEpochMs,createdAt:now,createdBy:actor.actorId};
  const writes=[
    {update:{name:docName(env,`tenants/${tenantId}/invitations/${invitationId}`),
      fields:fields(invitation)},currentDocument:{exists:false}},
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,
        action:"membership.invite_create",resourceType:"invitation",resourceId:invitationId,
        role,createdAt:now})},currentDocument:{exists:false}},
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok)return json(env,{error:"Falha ao emitir convite."},500);
  // No automated email delivery is configured: owner must share this code privately.
  return json(env,{ok:true,invitationId,role,expiresAtEpochMs,delivery:"manual"},201);
}
async function redeemStaffInvitation(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const invitationId=typeof data.invitationId==="string"?data.invitationId:"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId) ||
    !/^[0-9a-f-]{36}$/.test(invitationId))
    return json(env,{error:"Convite inválido."},400);
  const identity=await inviteIdentity(request,env);
  if(!identity)return json(env,{error:"Faça login com e-mail confirmado."},401);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const [tenant,invitation,existing]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    getDocument(env,token,`tenants/${tenantId}/invitations/${invitationId}`),
    getDocument(env,token,`memberships/${tenantId}_${identity.uid}`),
  ]);
  if(!tenant||str(tenant,"status")!=="active")return json(env,{error:"Studio indisponível."},404);
  if(!invitation||!invitation.updateTime || str(invitation,"tenantId")!==tenantId ||
    str(invitation,"status")!=="pending" || int(invitation,"expiresAtEpochMs")<=Date.now() ||
    str(invitation,"email")!==identity.email)
    return json(env,{error:"Convite inválido, expirado, utilizado ou destinado a outro e-mail."},403);
  // A role transition is allowed only by a fresh invitation + verified e-mail
  // accepted by the account holder. Tenant owner roles are NEVER transferable.
  if(existing && (str(existing,"tenantId")!==tenantId ||
    str(existing,"userId")!==identity.uid || !existing.updateTime ||
    !["customer","professional","tenant_admin"].includes(str(existing,"role")) ||
    !["active","disabled"].includes(str(existing,"status"))))
    return json(env,{error:"Este vínculo não pode ser convertido por convite."},409);
  const role=str(invitation,"role");
  if(!["tenant_admin","professional"].includes(role))return json(env,{error:"Papel inválido."},400);
  const professionalId=str(invitation,"professionalId");
  if(role==="professional"){
    const pro=await getDocument(env,token,`tenants/${tenantId}/professionals/${professionalId}`);
    if(!pro||str(pro,"tenantId")!==tenantId||!bool(pro,"active"))
      return json(env,{error:"Vínculo profissional indisponível."},409);
  }
  const counterPath=`tenants/${tenantId}/usage/staff`;
  const wasAdmin=existing && str(existing,"role")==="tenant_admin" && str(existing,"status")==="active";
  const willBeAdmin=role==="tenant_admin";
  const adminDelta=Number(willBeAdmin)-Number(Boolean(wasAdmin));
  const counter=adminDelta!==0?await getDocument(env,token,counterPath):null;
  let count=0;
  if(adminDelta!==0){
    count=counter&&counter.fields?.tenantAdminsAdditional?.integerValue!==undefined
      ?int(counter,"tenantAdminsAdditional")
      :(await listDocuments(env,token,"memberships")).filter(m=>str(m,"tenantId")===tenantId
        &&str(m,"role")==="tenant_admin"&&str(m,"status")==="active").length;
    const max=getLimit(asTenant(tenant,tenantId),"tenant_admins");
    if(!Number.isSafeInteger(count)||count<0||count+adminDelta<0||
      (adminDelta>0 && (max===0||(max!==null&&count+adminDelta>max))))
      return json(env,{error:"Quota de administradores atingida ou inconsistente."},409);
  }
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const member={tenantId,userId:identity.uid,role,status:"active",
    ...(role==="professional"?{professionalId}:{}),
    ...(existing?{updatedAt:now}:{createdAt:now,updatedAt:now})};
  const writes:Array<Record<string,unknown>>=[
    {update:{name:docName(env,`memberships/${tenantId}_${identity.uid}`),
      fields:fields(member)},
      ...(existing?{updateMask:{fieldPaths:["tenantId","userId","role","status",
        "professionalId","customerId","updatedAt"]}}:{}),
      currentDocument:existing?.updateTime?{updateTime:existing.updateTime}:{exists:false}},
    {update:{name:docName(env,`tenants/${tenantId}/invitations/${invitationId}`),
      fields:fields({status:"accepted",acceptedAt:now,acceptedBy:identity.uid})},
      updateMask:{fieldPaths:["status","acceptedAt","acceptedBy"]},
      currentDocument:{updateTime:invitation.updateTime}},
  ];
  if(adminDelta!==0)
    writes.push({update:{name:docName(env,counterPath),
      fields:fields({tenantAdminsAdditional:count+adminDelta,updatedAt:now})},
      updateMask:{fieldPaths:["tenantAdminsAdditional","updatedAt"]},
      currentDocument:counter?.updateTime?{updateTime:counter.updateTime}:{exists:false}});
  writes.push({update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
    fields:fields({tenantId,actorId:identity.uid,actorRole:role,action:existing?"membership.invite_transition":"membership.invite_accept",
      resourceType:"invitation",resourceId:invitationId,createdAt:now,
      before:existing?{role:str(existing,"role"),status:str(existing,"status"),
        professionalId:str(existing,"professionalId"),customerId:str(existing,"customerId")}:{},
      after:{role,status:"active",professionalId:role==="professional"?professionalId:""},adminDelta})},currentDocument:{exists:false}});
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const detail=await response.text();
    if([409,412].includes(response.status)||/FAILED_PRECONDITION|ABORTED|ALREADY_EXISTS/.test(detail))
      return json(env,{error:"Convite utilizado ou equipe modificada simultaneamente."},409);
    console.error("Invite acceptance failed",response.status,detail.slice(0,160));
    return json(env,{error:"Não foi possível aceitar convite."},500);
  }
  return json(env,{ok:true,role,tenantId,transitioned:Boolean(existing)});
}
async function listStaffInvitations(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId))return json(env,{error:"Tenant inválido."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor||!["tenant_owner","platform_owner"].includes(actor.actorRole))
    return json(env,{error:"Sem permissão para consultar convites."},403);
  const records=await listDocuments(env,token,`tenants/${tenantId}/invitations`);
  const invitations=records.slice(-250).map(doc=>({
    invitationId:doc.name.split("/").pop(),email:str(doc,"email"),role:str(doc,"role"),
    professionalId:str(doc,"professionalId"),status:str(doc,"status"),
    expiresAtEpochMs:int(doc,"expiresAtEpochMs"),createdAt:str(doc,"createdAt"),
  })).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return json(env,{invitations});
}
async function revokeStaffInvitation(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const invitationId=typeof data.invitationId==="string"?data.invitationId:"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId)||!/^[0-9a-f-]{36}$/.test(invitationId))
    return json(env,{error:"Convite inválido."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor||!["tenant_owner","platform_owner"].includes(actor.actorRole))
    return json(env,{error:"Sem autorização."},403);
  const invitation=await getDocument(env,token,`tenants/${tenantId}/invitations/${invitationId}`);
  if(!invitation||!invitation.updateTime||str(invitation,"status")!=="pending")
    return json(env,{error:"Convite não está pendente."},409);
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const writes=[
    {update:{name:docName(env,`tenants/${tenantId}/invitations/${invitationId}`),
      fields:fields({status:"revoked",revokedAt:now,revokedBy:actor.actorId})},
      updateMask:{fieldPaths:["status","revokedAt","revokedBy"]},
      currentDocument:{updateTime:invitation.updateTime}},
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,
        action:"membership.invite_revoke",resourceType:"invitation",
        resourceId:invitationId,createdAt:now})},currentDocument:{exists:false}},
  ];
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok)return json(env,{error:"Convite alterado; atualize e tente novamente."},409);
  return json(env,{ok:true,invitationId,status:"revoked"});
}

/** Platform-only repair for legacy/stale counters. Never changes roles or deletes data. */
async function reconcileTenantStaffUsage(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const reason=typeof data.reason==="string"?data.reason.trim():"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId)||reason.length<10||reason.length>300)
    return json(env,{error:"Tenant ou justificativa inválida."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor||actor.actorRole!=="platform_owner")
    return json(env,{error:"Apenas Platform Owner pode reconciliar quotas."},403);
  const [tenant,counter,professionals,memberships]=await Promise.all([
    getDocument(env,token,`tenants/${tenantId}`),
    getDocument(env,token,`tenants/${tenantId}/usage/staff`),
    listDocuments(env,token,`tenants/${tenantId}/professionals`),
    listDocuments(env,token,"memberships"),
  ]);
  if(!tenant)return json(env,{error:"Tenant inexistente."},404);
  const professionalsActive=professionals.filter(pro=>str(pro,"tenantId")===tenantId&&bool(pro,"active")).length;
  const tenantAdminsAdditional=memberships.filter(m=>str(m,"tenantId")===tenantId&&
    str(m,"role")==="tenant_admin"&&str(m,"status")==="active").length;
  const previous={
    professionalsActive:counter?.fields?.professionalsActive?.integerValue!==undefined
      ?int(counter,"professionalsActive"):null,
    tenantAdminsAdditional:counter?.fields?.tenantAdminsAdditional?.integerValue!==undefined
      ?int(counter,"tenantAdminsAdditional"):null,
  };
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const after={professionalsActive,tenantAdminsAdditional,updatedAt:now};
  const writes=[
    {update:{name:docName(env,`tenants/${tenantId}/usage/staff`),fields:fields(after)},
      updateMask:{fieldPaths:["professionalsActive","tenantAdminsAdditional","updatedAt"]},
      currentDocument:counter?.updateTime?{updateTime:counter.updateTime}:{exists:false}},
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,
        action:"usage.staff_reconcile",resourceType:"staffUsage",
        resourceId:"staff",reason,createdAt:now,
        before:{professionalsActive:previous.professionalsActive??-1,
          tenantAdminsAdditional:previous.tenantAdminsAdditional??-1},
        after})},currentDocument:{exists:false}},
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const detail=await response.text();
    if([409,412].includes(response.status)||/FAILED_PRECONDITION|ALREADY_EXISTS|ABORTED/.test(detail))
      return json(env,{error:"Equipe alterada em paralelo. Refaça a conferência."},409);
    console.error("Staff reconcile failed",response.status,detail.slice(0,170));
    return json(env,{error:"Erro ao reconciliar contadores."},500);
  }
  return json(env,{ok:true,before:previous,after:{professionalsActive,tenantAdminsAdditional},auditId});
}

/** Tenant-wide emergency pause for new Storage writes. Does not revoke read or delete data. */
async function setTenantMediaUploadPause(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const paused=data.paused;
  const reason=typeof data.reason==="string"?data.reason.trim():"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId)||typeof paused!=="boolean"||
    reason.length<10||reason.length>300)
    return json(env,{error:"Tenant, estado ou justificativa inválidos."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor||actor.actorRole!=="platform_owner")
    return json(env,{error:"Somente Platform Owner pode pausar uploads."},403);
  const tenant=await getDocument(env,token,`tenants/${tenantId}`);
  if(!tenant||!tenant.updateTime)return json(env,{error:"Tenant não encontrado."},404);
  const previous=bool(tenant,"mediaUploadsPaused"),now=new Date().toISOString(),auditId=crypto.randomUUID();
  if(previous===paused)return json(env,{ok:true,tenantId,paused,unchanged:true});
  const writes=[
    {update:{name:docName(env,`tenants/${tenantId}`),
      fields:fields({mediaUploadsPaused:paused,mediaUploadsPauseUpdatedAt:now})},
      updateMask:{fieldPaths:["mediaUploadsPaused","mediaUploadsPauseUpdatedAt"]},
      currentDocument:{updateTime:tenant.updateTime}},
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,
        action:"media.upload_pause",resourceType:"tenant",resourceId:tenantId,
        reason,before:{mediaUploadsPaused:previous},after:{mediaUploadsPaused:paused},createdAt:now})},
      currentDocument:{exists:false}},
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const detail=await response.text();
    if([409,412].includes(response.status)||/FAILED_PRECONDITION|ABORTED/.test(detail))
      return json(env,{error:"Tenant alterado simultaneamente; atualize."},409);
    console.error("Media pause update failed",response.status,detail.slice(0,170));
    return json(env,{error:"Não foi possível alterar bloqueio de upload."},500);
  }
  return json(env,{ok:true,tenantId,paused,auditId});
}


/** Review requests are RECORDS, never proof that the Storage object was deleted. */
function validPortfolioObject(tenantId:string,objectPath:string):boolean{
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId))return false;
  const prefix=`tenants/${tenantId}/public/portfolio/`;
  if(!objectPath.startsWith(prefix))return false;
  const file=objectPath.slice(prefix.length);
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,125}\.(?:webp|png|jpg|jpeg)$/.test(file)
    && !file.includes("..");
}
async function requestPortfolioRemoval(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const objectPath=typeof data.objectPath==="string"?data.objectPath:"";
  const reason=typeof data.reason==="string"?data.reason.trim():"";
  if(!validPortfolioObject(tenantId,objectPath)||reason.length<10||reason.length>500)
    return json(env,{error:"Foto, tenant ou justificativa inválidos."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor||!["tenant_owner","tenant_admin","platform_owner"].includes(actor.actorRole))
    return json(env,{error:"Sem permissão para solicitar retirada."},403);
  const tenant=await getDocument(env,token,`tenants/${tenantId}`);
  if(!tenant)return json(env,{error:"Tenant não encontrado."},404);
  const id=crypto.randomUUID(),auditId=crypto.randomUUID(),now=new Date().toISOString();
  const record={tenantId,objectPath,reason,status:"pending_review",requestedBy:actor.actorId,
    requestedByRole:actor.actorRole,createdAt:now};
  const writes=[
    {update:{name:docName(env,`tenants/${tenantId}/mediaRemovalRequests/${id}`),
      fields:fields(record)},currentDocument:{exists:false}},
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,
        action:"media.removal_request",resourceType:"mediaRemovalRequest",resourceId:id,
        createdAt:now,after:{objectPath,status:"pending_review"}})},currentDocument:{exists:false}},
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok)return json(env,{error:"Não foi possível registrar solicitação."},500);
  return json(env,{ok:true,requestId:id,status:"pending_review",objectPath},201);
}
async function listPortfolioRemovals(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId))
    return json(env,{error:"Tenant inválido."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor)return json(env,{error:"Sem permissão."},403);
  const rows=await listDocuments(env,token,`tenants/${tenantId}/mediaRemovalRequests`);
  const requests=rows.slice(-250).map(item=>({
    requestId:item.name.split("/").pop(),objectPath:str(item,"objectPath"),
    status:str(item,"status"),reason:str(item,"reason"),createdAt:str(item,"createdAt"),
    reviewedAt:str(item,"reviewedAt"),reviewReason:str(item,"reviewReason"),
    storageGeneration:str(item,"storageGeneration"),deletedAt:str(item,"deletedAt"),
  })).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return json(env,{requests});
}
async function reviewPortfolioRemoval(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const requestId=typeof data.requestId==="string"?data.requestId:"";
  const decision=data.decision==="approve"||data.decision==="reject"?data.decision:"";
  const reviewReason=typeof data.reviewReason==="string"?data.reviewReason.trim():"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId)||!/^[0-9a-f-]{36}$/.test(requestId)||
    !decision||reviewReason.length<10||reviewReason.length>500)
    return json(env,{error:"Revisão incompleta."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor||actor.actorRole!=="platform_owner")
    return json(env,{error:"Somente Platform Owner pode revisar solicitações."},403);
  const recordPath=`tenants/${tenantId}/mediaRemovalRequests/${requestId}`;
  const record=await getDocument(env,token,recordPath);
  if(!record||!record.updateTime||str(record,"tenantId")!==tenantId||
    str(record,"status")!=="pending_review"||
    !validPortfolioObject(tenantId,str(record,"objectPath")))
    return json(env,{error:"Solicitação inexistente, inválida ou já revisada."},409);
  const next=decision==="approve"?"approved_pending_manual_removal":"rejected";
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const writes=[
    {update:{name:docName(env,recordPath),
      fields:fields({status:next,reviewedAt:now,reviewedBy:actor.actorId,reviewReason})},
      updateMask:{fieldPaths:["status","reviewedAt","reviewedBy","reviewReason"]},
      currentDocument:{updateTime:record.updateTime}},
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId:actor.actorId,actorRole:actor.actorRole,
        action:"media.removal_review",resourceType:"mediaRemovalRequest",resourceId:requestId,
        createdAt:now,before:{status:"pending_review"},after:{status:next},
        reason:reviewReason})},currentDocument:{exists:false}},
  ];
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    const detail=await response.text();
    if([409,412].includes(response.status)||/FAILED_PRECONDITION|ABORTED/.test(detail))
      return json(env,{error:"Solicitação revisada simultaneamente."},409);
    return json(env,{error:"Falha ao registrar revisão."},500);
  }
  // Approval does NOT invoke Storage delete; external/manual authorized removal is still required.
  return json(env,{ok:true,requestId,status:next,storageDeleted:false});
}


/** Physical deletion is disabled by default; it requires independent explicit opt-in,
 * two-step approval, a precise Storage generation, and a privileged actor.
 */
/** Read-only operational capacity scan. No commercial cap or billing/egress estimates. */
async function scanPortfolioCapacity(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const pageToken=typeof data.pageToken==="string"?data.pageToken:"";
  const maxPages=data.maxPages===undefined?10:data.maxPages;
  const threshold=data.alertThresholdBytes;
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId)||pageToken.length>1200||
    typeof maxPages!=="number"||!Number.isInteger(maxPages)||maxPages<1||maxPages>20||
    (threshold!==undefined && (typeof threshold!=="number"||
      !Number.isSafeInteger(threshold)||threshold<1)))
    return json(env,{error:"Parâmetros de capacidade inválidos."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor||actor.actorRole!=="platform_owner")
    return json(env,{error:"Inventário reservado ao Platform Owner."},403);
  if(!await getDocument(env,token,"tenants/"+tenantId))
    return json(env,{error:"Tenant não encontrado."},404);
  const mediaToken=env.FIREBASE_STORAGE_EMULATOR_HOST?""
    :await serviceAccessToken(env,"https://www.googleapis.com/auth/devstorage.read_only");
  const result=await scanStoragePrefix(env,mediaToken,
    "tenants/"+tenantId+"/public/portfolio/",pageToken||undefined,maxPages);
  return json(env,{tenantId,...result,
    ...(threshold===undefined?{}:{alertThresholdBytes:threshold,
      observedThresholdExceeded:result.metrics.totalBytes>=threshold}),
    warning:"Somente tamanho dos objetos observados; páginas parciais não provam uso abaixo do limite. Não mede egress, fatura ou custo Google Cloud.",
  });
}
async function inventoryPortfolio(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const pageToken=typeof data.pageToken==="string"?data.pageToken:"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId)||pageToken.length>1200)
    return json(env,{error:"Inventário inválido."},400);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor||actor.actorRole!=="platform_owner")
    return json(env,{error:"Somente Platform Owner pode inventariar objetos."},403);
  if(!await getDocument(env,token,`tenants/${tenantId}`))
    return json(env,{error:"Tenant inexistente."},404);
  const mediaToken=env.FIREBASE_STORAGE_EMULATOR_HOST?""
    :await serviceAccessToken(env,"https://www.googleapis.com/auth/devstorage.read_only");
  const prefix=`tenants/${tenantId}/public/portfolio/`;
  const page=await listStoredObjects(env,mediaToken,prefix,pageToken||undefined);
  const objects=page.objects.filter(item=>item.name.startsWith(prefix)).map(item=>({
    path:item.name,generation:item.generation,size:item.size,
    mediaClass:item.metadata.mediaClass??"UNKNOWN_LEGACY",
    contentType:item.contentType,
  }));
  return json(env,{
    tenantId,pageCount:objects.length,pageBytes:objects.reduce((sum,o)=>sum+o.size,0),
    metrics:summarizeStoragePage(page.objects.filter(item=>item.name.startsWith(prefix))),
    objects,nextPageToken:page.nextPageToken,exhaustive:!page.nextPageToken,
    warning:"Medição somente da página atual de objetos; não representa egress, faturamento ou quota global.",
  });
}
async function commitMediaState(env:Env,token:string,tenantId:string,requestId:string,
  record:FireDoc,updates:Record<string,unknown>,action:string,actorId:string,
  reason:string):Promise<boolean>{
  const now=new Date().toISOString(),auditId=crypto.randomUUID();
  const headers:Record<string,string>={"content-type":"application/json"};
  if(token)headers.authorization=`Bearer ${token}`;
  const writes=[
    {update:{name:docName(env,`tenants/${tenantId}/mediaRemovalRequests/${requestId}`),
      fields:fields(updates)},
      updateMask:{fieldPaths:Object.keys(updates)},currentDocument:{updateTime:record.updateTime}},
    {update:{name:docName(env,`tenants/${tenantId}/auditLogs/${auditId}`),
      fields:fields({tenantId,actorId,actorRole:"platform_owner",action,resourceType:"mediaRemovalRequest",
        resourceId:requestId,reason,createdAt:now,
        before:{status:str(record,"status")},after:{status:String(updates.status)}})},
      currentDocument:{exists:false}},
  ];
  const response=await fetch(commitUrl(env),{method:"POST",headers,body:JSON.stringify({writes})});
  if(!response.ok){
    if([409,412].includes(response.status))return false;
    const body=await response.text();
    if(/FAILED_PRECONDITION|ABORTED/.test(body))return false;
    throw new Error(`Storage ledger commit HTTP ${response.status}`);
  }
  return true;
}
async function executeApprovedMediaDeletion(request:Request,env:Env):Promise<Response>{
  const data=await request.json() as Record<string,unknown>;
  const tenantId=typeof data.tenantId==="string"?data.tenantId:"";
  const requestId=typeof data.requestId==="string"?data.requestId:"";
  const expectedGeneration=typeof data.expectedGeneration==="string"?data.expectedGeneration:"";
  const confirmation=data.confirmation;
  const reason=typeof data.reason==="string"?data.reason.trim():"";
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(tenantId)||!/^[0-9a-f-]{36}$/.test(requestId)||
    !/^[1-9]\d{0,24}$/.test(expectedGeneration)||
    confirmation!=="REMOVER_MIDIA_APROVADA"||reason.length<10||reason.length>500)
    return json(env,{error:"Confirmação, geração ou justificativa inválidas."},400);
  if(env.MEDIA_DELETION_ENABLED!=="true")
    return json(env,{error:"Exclusão física desabilitada neste ambiente."},503);
  if(!env.FIREBASE_STORAGE_BUCKET)
    return json(env,{error:"Storage bucket não configurado para exclusão."},503);
  const token=env.FIRESTORE_EMULATOR_HOST?"":await serviceAccessToken(env);
  const actor=await tenantAdminIdentity(request,env,tenantId,token);
  if(!actor||actor.actorRole!=="platform_owner")
    return json(env,{error:"Somente Platform Owner pode excluir mídia aprovada."},403);
  const path=`tenants/${tenantId}/mediaRemovalRequests/${requestId}`;
  const record=await getDocument(env,token,path);
  if(!record||!record.updateTime||str(record,"tenantId")!==tenantId||
    !validPortfolioObject(tenantId,str(record,"objectPath")))
    return json(env,{error:"Solicitação inválida."},409);
  const objectPath=str(record,"objectPath"),status=str(record,"status");
  if(!["approved_pending_manual_removal","deletion_in_progress"].includes(status))
    return json(env,{error:"Solicitação não aprovada ou já encerrada."},409);
  if(status==="deletion_in_progress" && str(record,"storageGeneration")!==expectedGeneration)
    return json(env,{error:"Geração de remoção em andamento não corresponde."},409);
  const mediaToken=env.FIREBASE_STORAGE_EMULATOR_HOST?""
    :await serviceAccessToken(env,"https://www.googleapis.com/auth/devstorage.read_write");
  const current=await getStoredObject(env,mediaToken,objectPath);
  if(status==="approved_pending_manual_removal"){
    if(!current)return json(env,{error:"Objeto não encontrado antes da exclusão; revisão manual necessária."},409);
    if(current.name!==objectPath || current.generation!==expectedGeneration)
      return json(env,{error:"Objeto mudou de geração; não será removido."},409);
    // Unknown legacy media require separate explicit migration, NEVER automatic deletion.
    if(current.metadata.mediaClass!=="PERSISTENT_BUSINESS"||
      current.metadata.metadataPolicy!=="reencoded_no_exif")
      return json(env,{error:"Metadados não comprovam mídia do novo portfólio; revisão de legado necessária."},409);
    const now=new Date().toISOString();
    const locked=await commitMediaState(env,token,tenantId,requestId,record,{
      status:"deletion_in_progress",storageGeneration:expectedGeneration,
      storageSizeBytes:current.size,storageContentType:current.contentType,
      deletionStartedAt:now,executionActorId:actor.actorId,
    },"media.deletion_started",actor.actorId,reason);
    if(!locked)return json(env,{error:"Outro operador iniciou a execução. Recarregue."},409);
  } else if(current&&current.generation!==expectedGeneration) {
    return json(env,{error:"Geração alterada durante a remoção; abortado."},409);
  }
  // If a prior attempt already deleted the exact object and crashed before ledger
  // completion, this confirms absence in the provider before finalizing.
  if(current){
    const deleted=await deleteStoredGeneration(env,mediaToken,objectPath,expectedGeneration);
    if(deleted==="conflict")return json(env,{error:"Geração não corresponde; exclusão não executada."},409);
  }
  const after=await getStoredObject(env,mediaToken,objectPath);
  if(after)return json(env,{error:"Storage ainda contém o objeto. Estado pendente, sem confirmação de exclusão."},502);
  const fresh=await getDocument(env,token,path);
  if(!fresh||!fresh.updateTime||str(fresh,"status")!=="deletion_in_progress"||
    str(fresh,"storageGeneration")!==expectedGeneration)
    return json(env,{error:"Ledger alterado durante remoção; exige reconciliação."},409);
  const now=new Date().toISOString();
  const completed=await commitMediaState(env,token,tenantId,requestId,fresh,{
    status:"deleted_verified",deletedAt:now,storageVerifiedAbsentAt:now,
  },"media.deletion_verified",actor.actorId,reason);
  if(!completed)return json(env,{error:"Objeto ausente mas ledger não finalizou. Reexecute para conciliar."},409);
  return json(env,{ok:true,status:"deleted_verified",storageDeleted:true,
    requestId,storageGeneration:expectedGeneration,verifiedAt:now,
    warning:"Ausência no Storage verificada; caches externos e cópias podem ter retenção independente."});
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const originError = validateRequestOrigin(request,env);
    if (originError) return originError;
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...PRIVATE_HTTP_HEADERS,...cors(env) } });
    if (request.method === "GET" && url.pathname === "/health") return json(env, { ok: true, service: "saas-manicure-booking-api" });
    if(request.method==="POST" && url.pathname==="/api/admin/invitations/list"){
      try{return await listStaffInvitations(request,env);}
      catch(error){console.error("Invite list failed",error);return json(env,{error:"Não foi possível consultar convites."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/admin/invitations/create"){
      try{return await issueStaffInvitation(request,env);}
      catch(error){console.error("Invite create failed",error);return json(env,{error:"Falha ao emitir convite."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/admin/invitations/revoke"){
      try{return await revokeStaffInvitation(request,env);}
      catch(error){console.error("Invite revoke failed",error);return json(env,{error:"Falha ao revogar convite."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/invitations/accept"){
      try{return await redeemStaffInvitation(request,env);}
      catch(error){console.error("Invite acceptance failed",error);return json(env,{error:"Falha ao aceitar convite."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/customers/guest-claims/request"){
      try{return await requestGuestHistoryLink(request,env);}
      catch(error){console.error("Guest claim request failed",error);return json(env,{error:"Falha ao solicitar histórico."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/admin/guest-claims/list"){
      try{return await listGuestHistoryLinks(request,env);}
      catch(error){console.error("Guest claim list failed",error);return json(env,{error:"Falha na consulta."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/admin/guest-claims/review"){
      try{return await reviewGuestHistoryLink(request,env);}
      catch(error){console.error("Guest claim review failed",error);return json(env,{error:"Falha na revisão."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/customers/enroll"){
      try{return await enrollCustomer(request,env);}
      catch(error){console.error("Customer enroll failed",error);return json(env,{error:"Falha ao cadastrar cliente."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/customers/appointments/cancel"){
      try{return await cancelCustomerAppointment(request,env);}
      catch(error){console.error("Customer cancellation failed",error);return json(env,{error:"Falha no cancelamento."},500);}
    }
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
    if(request.method==="POST" && url.pathname==="/api/media/removal/request"){
      try{return await requestPortfolioRemoval(request,env);}
      catch(error){console.error("Media removal request failed",error);return json(env,{error:"Falha na solicitação."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/media/removal/list"){
      try{return await listPortfolioRemovals(request,env);}
      catch(error){console.error("Media removal list failed",error);return json(env,{error:"Falha ao consultar solicitações."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/platform/media/inventory/scan"){
      try{return await scanPortfolioCapacity(request,env);}
      catch(error){console.error("Media capacity scan failed",error);return json(env,{error:"Falha no inventário; nenhum limite de custo foi inferido."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/platform/media/inventory"){
      try{return await inventoryPortfolio(request,env);}
      catch(error){console.error("Media inventory failed",error);return json(env,{error:"Falha ao inventariar mídia."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/platform/media/removal/execute"){
      try{return await executeApprovedMediaDeletion(request,env);}
      catch(error){console.error("Media deletion failed",error);return json(env,{error:"Falha ao executar exclusão; verifique estado antes de repetir."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/platform/media/removal/review"){
      try{return await reviewPortfolioRemoval(request,env);}
      catch(error){console.error("Media removal review failed",error);return json(env,{error:"Falha ao revisar solicitação."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/platform/media/pause"){
      try{return await setTenantMediaUploadPause(request,env);}
      catch(error){console.error("Media pause update failed",error);return json(env,{error:"Falha ao alterar upload."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/platform/usage/reconcile"){
      try{return await reconcileTenantStaffUsage(request,env);}
      catch(error){console.error("Usage reconcile failed",error);return json(env,{error:"Falha na reconciliação."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/admin/usage"){
      try{return await tenantQuotaOverview(request,env);}
      catch(error){console.error("Quota overview failed",error);return json(env,{error:"Não foi possível consultar quotas."},500);}
    }
    if(request.method==="POST" && url.pathname==="/api/admin/exports/appointments"){
      try{return await exportTenantAppointments(request,env);}
      catch(error){console.error("Export failed",error);return json(env,{error:"Falha ao exportar agendamentos."},500);}
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
    if(request.method==="POST" && url.pathname==="/api/admin/professionals/edit"){
      try{return await editProfessional(request,env);}
      catch(error){console.error("Professional edit error",error);return json(env,{error:"Falha ao editar profissional."},500);}
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
      catch (error) { console.error("Booking error",error); return json(env, { error: "Falha interna ao processar reserva. Tente novamente ou contate o studio." }, 500); }
    }
    return json(env, { error: "Not found" }, 404);
  },
};
