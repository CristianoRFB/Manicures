interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  ALLOWED_ORIGIN?: string;
  FIRESTORE_EMULATOR_HOST?: string;
}

type FireValue = { stringValue?: string; integerValue?: string; booleanValue?: boolean; mapValue?: { fields: Record<string, FireValue> }; arrayValue?: { values: FireValue[] } };
type FireDoc = { name: string; fields?: Record<string, FireValue> };

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function cors(env: Env) {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN ?? "*",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type",
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

async function createBooking(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const tenantId = String(body.tenantId ?? "");
  const serviceId = String(body.serviceId ?? "");
  const professionalId = String(body.professionalId ?? "");
  const startsAt = String(body.startsAt ?? "");
  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  if (!tenantId || !serviceId || !professionalId || !startsAt || !customerName || !customerPhone) return json(env, { error: "Dados obrigatórios ausentes." }, 400);

  const token = env.FIRESTORE_EMULATOR_HOST ? "" : await serviceAccessToken(env);
  const [tenant, service, professional] = await Promise.all([
    getDocument(env, token, `tenants/${tenantId}`),
    getDocument(env, token, `tenants/${tenantId}/services/${serviceId}`),
    getDocument(env, token, `tenants/${tenantId}/professionals/${professionalId}`),
  ]);
  if (!tenant || str(tenant, "status") !== "active") return json(env, { error: "Tenant indisponível." }, 404);
  if (!service || !bool(service, "active")) return json(env, { error: "Serviço indisponível." }, 400);
  if (!professional || !bool(professional, "active") || !arr(professional, "serviceIds").includes(serviceId)) return json(env, { error: "Profissional indisponível para o serviço." }, 400);

  const duration = int(service, "durationMin");
  const price = int(service, "priceCents");
  if (!Number.isInteger(duration) || duration <= 0 || !Number.isInteger(price) || price < 0) return json(env, { error: "Configuração de serviço inválida." }, 500);

  const { dateKey, startMinute } = localParts(startsAt);
  const endMinute = startMinute + duration;
  if (startMinute < 9 * 60 || endMinute > 18 * 60 || (startMinute < 13 * 60 && endMinute > 12 * 60)) return json(env, { error: "Horário fora da disponibilidade operacional." }, 409);

  const appointmentId = crypto.randomUUID();
  const endsAt = addMinutes(startsAt, duration);
  const now = new Date().toISOString();
  const locks = lockMinutes(startMinute, endMinute).map((minute) => ({ id: `${professionalId}_${dateKey}_${minute}`, minute }));

  const writes = [
    {
      update: {
        name: docName(env, `tenants/${tenantId}/appointments/${appointmentId}`),
        fields: fields({ appointmentId, tenantId, customerName, customerPhone, professionalId, serviceId, startsAt, endsAt, dateKey, startMinute, endMinute, priceSnapshotCents: price, durationSnapshotMin: duration, status: "pending", createdAt: now, updatedAt: now }),
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

  return json(env, { appointment: { id: appointmentId, tenantId, customerName, customerPhone, professionalId, serviceId, startsAt, endsAt, priceSnapshotCents: price, durationSnapshotMin: duration, status: "pending", createdAt: now, updatedAt: now } }, 201);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    if (request.method === "GET" && url.pathname === "/health") return json(env, { ok: true, service: "saas-manicure-booking-api" });
    if (request.method === "POST" && url.pathname === "/api/bookings") {
      try { return await createBooking(request, env); }
      catch (error) { console.error(error); return json(env, { error: error instanceof Error ? error.message : "Erro interno." }, 500); }
    }
    return json(env, { error: "Not found" }, 404);
  },
};
