import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import worker from "./index";

const projectId = "manicure-worker-test";
let adminApp: App;

const emulatorHost = "127.0.0.1:8080";

function env() {
  return {
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_CLIENT_EMAIL: "emulator@example.test",
    FIREBASE_PRIVATE_KEY: "not-used-in-emulator",
    FIRESTORE_EMULATOR_HOST: emulatorHost,
    ALLOWED_ORIGIN: "http://localhost:5173",
  };
}

async function clearFirestore(host: string) {
  const response = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Falha limpando emulator: ${response.status}`);
}

async function seed() {
  const db = getFirestore(adminApp);
  await Promise.all([
    db.doc("tenants/a").set({ slug:"a", name:"A", status:"active", kind:"demo", commercial:{planId:"pro",subscriptionStatus:"active"} }),
    db.doc("tenants/a/services/s1").set({ tenantId:"a", name:"Manicure", priceCents:4000, durationMin:60, active:true }),
    db.doc("tenants/a/professionals/p1").set({ tenantId:"a", name:"Profissional A", active:true, serviceIds:["s1"] }),
    db.doc("tenants/b").set({ slug:"b", name:"B", status:"active", kind:"demo", commercial:{planId:"premium_demo",subscriptionStatus:"demo"} }),
    db.doc("tenants/b/services/s1").set({ tenantId:"b", name:"Manicure B", priceCents:5000, durationMin:60, active:true }),
    db.doc("tenants/b/professionals/p1").set({ tenantId:"b", name:"Profissional B", active:true, serviceIds:["s1"] }),
    db.doc("memberships/a_ownerA").set({userId:"ownerA",tenantId:"a",role:"tenant_owner",status:"active"}),
    db.doc("memberships/b_ownerB").set({userId:"ownerB",tenantId:"b",role:"tenant_owner",status:"active"}),
    db.doc("platformUsers/platform").set({role:"platform_owner",status:"active"}),
  ]);
}

async function book(tenantId: string, startsAt: string) {
  const request = new Request("http://worker.local/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenantId, serviceId:"s1", professionalId:"p1", startsAt, customerName:"Cliente Teste", customerPhone:"00000000000" }),
  });
  return worker.fetch(request, env());
}

beforeAll(() => {
  adminApp = initializeApp({ projectId }, "worker-test");
});

afterAll(async () => {
  if (adminApp) await deleteApp(adminApp);
});

beforeEach(async () => {
  await clearFirestore(emulatorHost);
  await seed();
});

describe("Booking Worker trusted concurrency", () => {
  it("cria appointment com snapshots vindos do serviço", async () => {
    const response = await book("a", "2026-11-03T14:00:00");
    expect(response.status).toBe(201);
    const payload = await response.json() as { appointment: { priceSnapshotCents:number; durationSnapshotMin:number; tenantId:string } };
    expect(payload.appointment.tenantId).toBe("a");
    expect(payload.appointment.priceSnapshotCents).toBe(4000);
    expect(payload.appointment.durationSnapshotMin).toBe(60);
  });

  it("recusa overlap concorrente pelo bookingLock", async () => {
    const first = await book("a", "2026-11-03T14:00:00");
    expect(first.status).toBe(201);
    const overlap = await book("a", "2026-11-03T14:30:00");
    expect(overlap.status).toBe(409);
  });

  it("locks permanecem isolados entre Tenant A e Tenant B", async () => {
    const a = await book("a", "2026-11-03T15:00:00");
    const b = await book("b", "2026-11-03T15:00:00");
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });
});


describe("Commercial backend enforcement",()=>{
  it("nega booking com plano suspenso mesmo com tenant ativo",async()=>{
    await getFirestore(adminApp).doc("tenants/a").update({commercial:{planId:"pro",subscriptionStatus:"suspended"}});
    expect((await book("a","2026-11-03T14:00:00")).status).toBe(403);
  });
  it("nega booking quando trial expirou e preserva outro tenant",async()=>{
    await getFirestore(adminApp).doc("tenants/a").update({commercial:{planId:"pro",subscriptionStatus:"trial",trialUntil:"2020-01-01T00:00:00Z"}});
    expect((await book("a","2026-11-03T14:00:00")).status).toBe(403);
    expect((await book("b","2026-11-03T14:00:00")).status).toBe(201);
  });
  it("override explícito false bloqueia booking",async()=>{
    await getFirestore(adminApp).doc("tenants/a").update({commercial:{planId:"pro",subscriptionStatus:"active",entitlementOverrides:{"booking.create":false}}});
    expect((await book("a","2026-11-03T14:00:00")).status).toBe(403);
  });
});

describe("Trusted commercial and professional writes",()=>{
  let realFetch:typeof fetch, jwk:JsonWebKey, privateKey:CryptoKey;
  beforeAll(async()=>{
    const pair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
      publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
    privateKey=pair.privateKey;
    jwk=await crypto.subtle.exportKey("jwk",pair.publicKey);
    (jwk as JsonWebKey & {kid:string}).kid="test-kid";
    realFetch=globalThis.fetch;
    vi.stubGlobal("fetch",((input:RequestInfo | URL, init?:RequestInit)=>{
      if(String(input).includes("www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"))
        return Promise.resolve(new Response(JSON.stringify({keys:[jwk]}),{status:200,headers:{"content-type":"application/json"}}));
      return realFetch(input,init);
    }) as typeof fetch);
  });
  afterAll(()=>{vi.unstubAllGlobals();});
  async function signedToken(uid:string) {
    const now=Math.floor(Date.now()/1000);
    const b64=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
    const head=b64({alg:"RS256",kid:"test-kid"});
    const claims=b64({iss:`https://securetoken.google.com/${projectId}`,aud:projectId,sub:uid,iat:now-10,auth_time:now-10,exp:now+600});
    const unsigned=`${head}.${claims}`;
    const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",privateKey,new TextEncoder().encode(unsigned));
    return `${unsigned}.${Buffer.from(sig).toString("base64url")}`;
  }
  async function create(tenantId:string,uid:string,name:string) {
    return worker.fetch(new Request("http://worker.local/api/admin/professionals",{
      method:"POST",
      headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(uid)}`},
      body:JSON.stringify({tenantId,name,serviceIds:["s1"]}),
    }),env());
  }
  async function manageAdmin(tenantId:string,actorUid:string,targetUserId:string,status:"active"|"disabled"="active") {
    return worker.fetch(new Request("http://worker.local/api/admin/memberships/tenant-admin",{
      method:"POST",
      headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(actorUid)}`},
      body:JSON.stringify({tenantId,userId:targetUserId,status}),
    }),env());
  }
  it("Pro: limita a dois administradores adicionais, com auditoria",async()=>{
    expect((await manageAdmin("a","platform","admin1")).status).toBe(200);
    expect((await manageAdmin("a","platform","admin2")).status).toBe(200);
    expect((await manageAdmin("a","platform","admin3")).status).toBe(409);
    const doc=await getFirestore(adminApp).doc("tenants/a/usage/staff").get();
    expect(doc.data()?.tenantAdminsAdditional).toBe(2);
    const logs=await getFirestore(adminApp).collection("tenants/a/auditLogs").get();
    expect(logs.size).toBe(2);
  });
  it("desativar admin libera quota sem apagar membership nem histórico",async()=>{
    expect((await manageAdmin("a","platform","admin1")).status).toBe(200);
    expect((await manageAdmin("a","platform","admin1","disabled")).status).toBe(200);
    const member=await getFirestore(adminApp).doc("memberships/a_admin1").get();
    expect(member.data()?.status).toBe("disabled");
    expect((await manageAdmin("a","platform","admin2")).status).toBe(200);
    const counter=await getFirestore(adminApp).doc("tenants/a/usage/staff").get();
    expect(counter.data()?.tenantAdminsAdditional).toBe(1);
  });
  it("Essencial não aceita administrador adicional",async()=>{
    await getFirestore(adminApp).doc("tenants/a").update({commercial:{planId:"essencial",subscriptionStatus:"active"}});
    expect((await manageAdmin("a","platform","admin1")).status).toBe(409);
  });
  it("usuário de A não altera admin de B; owner não cria membership não verificada",async()=>{
    expect((await manageAdmin("b","ownerA","adminB")).status).toBe(403);
    expect((await manageAdmin("a","ownerA","novoAdmin")).status).toBe(403);
  });
  it("downgrade não apaga admins existentes e impede ampliar excedente",async()=>{
    expect((await manageAdmin("a","platform","admin1")).status).toBe(200);
    await getFirestore(adminApp).doc("tenants/a").update({commercial:{planId:"essencial",subscriptionStatus:"active"}});
    expect((await getFirestore(adminApp).doc("memberships/a_admin1").get()).exists).toBe(true);
    expect((await manageAdmin("a","platform","admin2")).status).toBe(409);
    expect((await manageAdmin("a","platform","admin1","disabled")).status).toBe(200);
  });
  it("criação concorrente não ultrapassa limite de administradores",async()=>{
    expect((await manageAdmin("a","platform","admin1")).status).toBe(200);
    const results=await Promise.all([
      manageAdmin("a","platform","admin2"),
      manageAdmin("a","platform","admin3"),
    ]);
    expect(results.filter(r=>r.status===200)).toHaveLength(1);
    const active=(await getFirestore(adminApp).collection("memberships").get()).docs
      .filter(doc=>doc.data().tenantId==="a" && doc.data().role==="tenant_admin" && doc.data().status==="active");
    expect(active).toHaveLength(2);
  });

  it("Pro 3: contador atômico barra criação acima do limite",async()=>{
    expect((await create("a","ownerA","Segunda manicure")).status).toBe(201);
    expect((await create("a","ownerA","Terceira manicure")).status).toBe(201);
    expect((await create("a","ownerA","Quarta manicure")).status).toBe(409);
    const docs=await getFirestore(adminApp).collection("tenants/a/professionals").get();
    expect(docs.docs.filter(doc=>doc.data().active).length).toBe(3);
    const counter=await getFirestore(adminApp).doc("tenants/a/usage/staff").get();
    expect(counter.data()?.professionalsActive).toBe(3);
  });
  it("owner de A não cria profissional em B",async()=>{
    expect((await create("b","ownerA","Intruso")).status).toBe(403);
  });
  it("duas criações simultâneas não ultrapassam limite Essencial",async()=>{
    await getFirestore(adminApp).doc("tenants/a").update({commercial:{planId:"essencial",subscriptionStatus:"active"}});
    const [a,b]=await Promise.all([create("a","ownerA","Mais uma"),create("a","ownerA","Outra profissional")]);
    expect([a.status,b.status].sort()).toEqual([409,409]); // p1 já ocupa única vaga
  });
  it("Platform Owner atribui plano e audita before/after",async()=>{
    const token=await signedToken("platform");
    const response=await worker.fetch(new Request("http://worker.local/api/admin/plans/assign",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},
      body:JSON.stringify({tenantId:"a",planId:"essencial",subscriptionStatus:"active",reason:"Ajuste manual aprovado pela plataforma"}),
    }),env());
    expect(response.status).toBe(200);
    const tenant=(await getFirestore(adminApp).doc("tenants/a").get()).data();
    expect(tenant?.commercial.planId).toBe("essencial");
    const logs=await getFirestore(adminApp).collection("tenants/a/auditLogs").get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0].data().before.planId).toBe("pro");
    expect(logs.docs[0].data().actorId).toBe("platform");
  });
  it("consulta disponibilidade sem expor PII e atualiza após booking/cancelamento",async()=>{
    const availability=()=>worker.fetch(new Request("http://worker.local/api/availability?tenantId=a&serviceId=s1&professionalId=p1&date=2026-11-03"),env());
    const first=await availability();
    expect(first.status).toBe(200);
    const initial=await first.json() as {slots:string[]};
    expect(initial.slots).toContain("2026-11-03T14:00:00");
    expect(JSON.stringify(initial)).not.toContain("customerPhone");
    const booking=await book("a","2026-11-03T14:00:00");
    expect(booking.status).toBe(201);
    const body=await booking.json() as {appointment:{id:string}};
    const occupied=await (await availability()).json() as {slots:string[]};
    expect(occupied.slots).not.toContain("2026-11-03T14:00:00");
    const token=await signedToken("ownerA");
    const cancel=await worker.fetch(new Request("http://worker.local/api/admin/appointments/status",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},
      body:JSON.stringify({tenantId:"a",appointmentId:body.appointment.id,status:"cancelled"}),
    }),env());
    expect(cancel.status).toBe(200);
    const released=await (await availability()).json() as {slots:string[]};
    expect(released.slots).toContain("2026-11-03T14:00:00");
    const appointment=(await getFirestore(adminApp).doc(`tenants/a/appointments/${body.appointment.id}`).get()).data();
    expect(appointment?.status).toBe("cancelled");
  });
  it("status inválido e usuário de outro tenant são rejeitados",async()=>{
    const booking=await book("a","2026-11-03T14:00:00");
    expect(booking.status).toBe(201);
    const body=await booking.json() as {appointment:{id:string}};
    const status=async (uid:string,next:string)=>worker.fetch(new Request("http://worker.local/api/admin/appointments/status",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(uid)}`},
      body:JSON.stringify({tenantId:"a",appointmentId:body.appointment.id,status:next}),
    }),env());
    expect((await status("ownerB","confirmed")).status).toBe(403);
    expect((await status("ownerA","no_show")).status).toBe(409);
    expect((await status("ownerA","confirmed")).status).toBe(200);
    expect((await status("ownerA","completed")).status).toBe(409);
  });

  it("override manual é persistido, auditado e revoga booking no Worker",async()=>{
    const token=await signedToken("platform");
    const response=await worker.fetch(new Request("http://worker.local/api/admin/plans/assign",{
      method:"POST",
      headers:{"content-type":"application/json",authorization:`Bearer ${token}`},
      body:JSON.stringify({
        tenantId:"a",planId:"pro",subscriptionStatus:"active",
        reason:"Override temporário registrado pela plataforma",
        entitlementOverrides:{"booking.create":false},
        limitOverrides:{professionals_active:2,tenant_admins:1}
      }),
    }),env());
    expect(response.status).toBe(200);
    const stored=(await getFirestore(adminApp).doc("tenants/a").get()).data();
    expect(stored?.commercial.entitlementOverrides["booking.create"]).toBe(false);
    expect(stored?.commercial.limitOverrides.professionals_active).toBe(2);
    expect((await book("a","2026-11-03T14:00:00")).status).toBe(403);
    const logs=await getFirestore(adminApp).collection("tenants/a/auditLogs").get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0].data().after.entitlementOverrides["booking.create"]).toBe(false);
  });
  it("tenant owner não atribui plano nem falsifica operador",async()=>{
    const token=await signedToken("ownerA");
    const response=await worker.fetch(new Request("http://worker.local/api/admin/plans/assign",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},
      body:JSON.stringify({tenantId:"a",planId:"premium",subscriptionStatus:"active",reason:"Tentativa não autorizada"}),
    }),env());
    expect(response.status).toBe(403);
  });
});
