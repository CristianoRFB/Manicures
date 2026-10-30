import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
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
  async function signedToken(uid:string,verified=false,email?:string) {
    const now=Math.floor(Date.now()/1000);
    const b64=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
    const head=b64({alg:"RS256",kid:"test-kid"});
    const claims=b64({iss:`https://securetoken.google.com/${projectId}`,aud:projectId,sub:uid,iat:now-10,auth_time:now-10,exp:now+600,email_verified:verified,email});
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

  const customerRequest=async(path:string,uid:string,body:Record<string,unknown>,verified=true)=>{
    return worker.fetch(new Request(`http://worker.local${path}`,{
      method:"POST",
      headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(uid,verified)}`},
      body:JSON.stringify(body),
    }),env());
  };
  const registerCustomer=(uid:string,tenantId="a",verified=true)=>customerRequest("/api/customers/enroll",uid,{tenantId},verified);
  const cancelOwn=(uid:string,appointmentId:string,tenantId="a")=>
    customerRequest("/api/customers/appointments/cancel",uid,{tenantId,appointmentId});
  const customerBooking=async(uid:string,tenantId="a",startsAt="2026-11-03T14:00:00",additional:Record<string,unknown>={})=>
    customerRequest("/api/bookings",uid,{tenantId,serviceId:"s1",professionalId:"p1",startsAt,
      customerName:"Cliente",customerPhone:"5517999999999",...additional});
  it("auto-cadastro exige e-mail confirmado, cria apenas papel customer e preserva membership de owner",async()=>{
    expect((await registerCustomer("cliente1","a",false)).status).toBe(401);
    expect((await registerCustomer("cliente1")).status).toBe(201);
    expect((await registerCustomer("cliente1")).status).toBe(200);
    const member=(await getFirestore(adminApp).doc("memberships/a_cliente1").get()).data();
    expect(member?.role).toBe("customer");
    expect(member?.customerId).toBe("cliente1");
    expect((await registerCustomer("ownerA")).status).toBe(409);
    expect((await getFirestore(adminApp).doc("memberships/a_ownerA").get()).data()?.role).toBe("tenant_owner");
  });
  it("booking autenticado salva apenas customerId assinado e não aceita tenant errado",async()=>{
    expect((await registerCustomer("cliente1")).status).toBe(201);
    const booked=await customerBooking("cliente1","a","2026-11-03T14:00:00",{customerId:"outraPessoa"});
    expect(booked.status).toBe(201);
    const payload=await booked.json() as {appointment:{id:string;customerId:string}};
    expect(payload.appointment.customerId).toBe("cliente1");
    const stored=(await getFirestore(adminApp).doc(`tenants/a/appointments/${payload.appointment.id}`).get()).data();
    expect(stored?.customerId).toBe("cliente1");
    expect((await customerBooking("cliente1","b")).status).toBe(403);
    expect((await customerBooking("semVinculo")).status).toBe(403);
  });
  it("cancelamento próprio libera locks, mantém histórico e gera audit log",async()=>{
    await registerCustomer("cliente1");
    const booked=await customerBooking("cliente1");
    expect(booked.status).toBe(201);
    const id=(await booked.json() as {appointment:{id:string}}).appointment.id;
    expect((await cancelOwn("cliente2",id)).status).toBe(403);
    await registerCustomer("cliente2");
    expect((await cancelOwn("cliente2",id)).status).toBe(404);
    expect((await cancelOwn("cliente1",id)).status).toBe(200);
    const db=getFirestore(adminApp);
    expect((await db.doc(`tenants/a/appointments/${id}`).get()).data()?.status).toBe("cancelled");
    expect((await db.doc("tenants/a/bookingLocks/p1_2026-11-03_840").get()).exists).toBe(false);
    const logs=(await db.collection("tenants/a/auditLogs").get()).docs;
    expect(logs.some(doc=>doc.data().action==="appointments.customer_cancel")).toBe(true);
    expect((await cancelOwn("cliente1",id)).status).toBe(409);
    expect((await book("a","2026-11-03T14:00:00")).status).toBe(201);
  });
  it("não permite que cliente reivindique booking guest por telefone ou body.customerId",async()=>{
    const guest=await book("a","2026-11-03T14:00:00");
    const id=(await guest.json() as {appointment:{id:string}}).appointment.id;
    await registerCustomer("cliente1");
    expect((await cancelOwn("cliente1",id)).status).toBe(404);
    expect((await getFirestore(adminApp).doc(`tenants/a/appointments/${id}`).get()).data()?.customerId).toBeUndefined();
  });
  async function usageFor(uid:string,tenantId="a"){
    return worker.fetch(new Request("http://worker.local/api/admin/usage",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(uid)}`},
      body:JSON.stringify({tenantId}),
    }),env());
  }
  it("mostra excedente de downgrade sem excluir dados ou permitir acesso do tenant B",async()=>{
    const created=await create("a","ownerA","Segunda");
    expect(created.status).toBe(201);
    await getFirestore(adminApp).doc("tenants/a").update({commercial:{planId:"essencial",subscriptionStatus:"active"}});
    const view=await usageFor("ownerA");
    expect(view.status).toBe(200);
    const data=await view.json() as {usage:{professionals_active:number};limits:{professionals_active:number};exceeded:{professionals_active:boolean}};
    expect(data.usage.professionals_active).toBe(2);
    expect(data.limits.professionals_active).toBe(1);
    expect(data.exceeded.professionals_active).toBe(true);
    expect((await getFirestore(adminApp).collection("tenants/a/professionals").get()).size).toBe(2);
    expect((await usageFor("ownerB")).status).toBe(403);
  });
  async function invitationRequest(path:string,uid:string,body:Record<string,unknown>,
    verified=true,email="member@example.test"){
    return worker.fetch(new Request(`http://worker.local${path}`,{
      method:"POST",headers:{"content-type":"application/json",
        authorization:`Bearer ${await signedToken(uid,verified,email)}`},
      body:JSON.stringify(body),
    }),env());
  }
  async function issueInvite(actor="ownerA",role:"tenant_admin"|"professional"="tenant_admin",
    tenantId="a",email="member@example.test"){
    return invitationRequest("/api/admin/invitations/create",actor,
      {tenantId,email,role,...(role==="professional"?{professionalId:"p1"}:{})});
  }
  async function claimInvite(uid:string,invitationId:string,tenantId="a",
    verified=true,email="member@example.test"){
    return invitationRequest("/api/invitations/accept",uid,
      {tenantId,invitationId},verified,email);
  }
  it("convite admin verificado é de uso único, atômico e contabilizado",async()=>{
    const issued=await issueInvite();
    expect(issued.status).toBe(201);
    const {invitationId}=await issued.json() as {invitationId:string};
    expect((await claimInvite("newAdmin",invitationId,"a",false)).status).toBe(401);
    expect((await claimInvite("newAdmin",invitationId,"a",true,"wrong@example.test")).status).toBe(403);
    expect((await claimInvite("newAdmin",invitationId,"b")).status).toBe(403);
    const concurrent=await Promise.all([
      claimInvite("newAdmin",invitationId),
      claimInvite("newAdmin",invitationId),
    ]);
    expect(concurrent.filter(r=>r.status===200)).toHaveLength(1);
    expect(concurrent.filter(r=>r.status===409||r.status===403)).toHaveLength(1);
    const db=getFirestore(adminApp);
    const member=(await db.doc("memberships/a_newAdmin").get()).data();
    expect(member?.role).toBe("tenant_admin");
    expect(member?.status).toBe("active");
    const counter=await db.doc("tenants/a/usage/staff").get();
    expect(counter.data()?.tenantAdminsAdditional).toBe(1);
    const invitation=(await db.doc(`tenants/a/invitations/${invitationId}`).get()).data();
    expect(invitation?.status).toBe("accepted");
    expect((await claimInvite("second",invitationId)).status).toBe(403);
  });
  it("owner A não convida em B e limite Essencial é aplicado no aceite",async()=>{
    expect((await issueInvite("ownerA","tenant_admin","b")).status).toBe(403);
    const invite=await issueInvite();
    const id=(await invite.json() as {invitationId:string}).invitationId;
    await getFirestore(adminApp).doc("tenants/a").update({commercial:{planId:"essencial",subscriptionStatus:"active"}});
    expect((await claimInvite("newAdmin",id)).status).toBe(409);
    expect((await getFirestore(adminApp).doc("memberships/a_newAdmin").get()).exists).toBe(false);
    expect((await issueInvite()).status).toBe(409);
  });
  it("convites expiram, revogação bloqueia e não apaga log",async()=>{
    const invite=await issueInvite();
    const id=(await invite.json() as {invitationId:string}).invitationId;
    await getFirestore(adminApp).doc(`tenants/a/invitations/${id}`).update({expiresAtEpochMs:Date.now()-1000});
    expect((await claimInvite("newAdmin",id)).status).toBe(403);
    const issued=await issueInvite();
    const id2=(await issued.json() as {invitationId:string}).invitationId;
    expect((await invitationRequest("/api/admin/invitations/revoke","ownerB",{tenantId:"a",invitationId:id2})).status).toBe(403);
    expect((await invitationRequest("/api/admin/invitations/revoke","ownerA",{tenantId:"a",invitationId:id2})).status).toBe(200);
    expect((await claimInvite("newAdmin",id2)).status).toBe(403);
  });
  it("profissional convidada só recebe papel e vínculo profissional informado",async()=>{
    const invite=await issueInvite("ownerA","professional");
    expect(invite.status).toBe(201);
    const {invitationId}=await invite.json() as {invitationId:string};
    expect((await claimInvite("newPro",invitationId)).status).toBe(200);
    const membership=(await getFirestore(adminApp).doc("memberships/a_newPro").get()).data();
    expect(membership?.role).toBe("professional");
    expect(membership?.professionalId).toBe("p1");
    const usage=(await getFirestore(adminApp).doc("tenants/a/usage/staff").get()).data();
    expect(usage?.tenantAdminsAdditional).toBeUndefined();
  });
  it("reconciliação restaura contador legado e audita sem alterar membership",async()=>{
    const db=getFirestore(adminApp);
    await db.doc("tenants/a/usage/staff").set({professionalsActive:99,tenantAdminsAdditional:99});
    await db.doc("memberships/a_existing-admin").set({
      tenantId:"a",userId:"existing-admin",role:"tenant_admin",status:"active",
    });
    const request=async(uid:string,tenantId="a")=>worker.fetch(new Request(
      "http://worker.local/api/platform/usage/reconcile",{
        method:"POST",headers:{"content-type":"application/json",
          authorization:`Bearer ${await signedToken(uid)}`},
        body:JSON.stringify({tenantId,reason:"Recálculo por divergência verificada"}),
      }),env());
    expect((await request("ownerA")).status).toBe(403);
    expect((await request("platform")).status).toBe(200);
    const usage=(await db.doc("tenants/a/usage/staff").get()).data();
    expect(usage?.professionalsActive).toBe(1);
    expect(usage?.tenantAdminsAdditional).toBe(1);
    expect((await db.doc("memberships/a_existing-admin").get()).data()?.status).toBe("active");
    const logs=await db.collection("tenants/a/auditLogs").get();
    expect(logs.docs.some(x=>x.data().action==="usage.staff_reconcile")).toBe(true);
    const b=await db.doc("tenants/b/usage/staff").get();
    expect(b.exists).toBe(false);
  });
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
  it("bloqueia promoção direta de cliente/profissional para admin sem novo aceite verificado",async()=>{
    const db=getFirestore(adminApp);
    await db.doc("memberships/a_client-signed").set({
      tenantId:"a",userId:"client-signed",role:"customer",status:"active",customerId:"client-signed",
    });
    expect((await manageAdmin("a","ownerA","client-signed")).status).toBe(403);
    expect((await manageAdmin("a","platform","client-signed")).status).toBe(403);
    await db.doc("memberships/a_pro-signed").set({
      tenantId:"a",userId:"pro-signed",role:"professional",status:"active",professionalId:"p1",
    });
    expect((await manageAdmin("a","ownerA","pro-signed")).status).toBe(403);
    expect((await db.doc("memberships/a_client-signed").get()).data()?.role).toBe("customer");
    expect((await db.doc("memberships/a_pro-signed").get()).data()?.role).toBe("professional");
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

  async function activateProfessional(tenantId:string, actorUid:string, professionalId:string,active:boolean) {
    return worker.fetch(new Request("http://worker.local/api/admin/professionals/activation",{
      method:"POST",
      headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(actorUid)}`},
      body:JSON.stringify({tenantId,professionalId,active}),
    }),env());
  }
  it("desativar e reativar profissional ajusta quota sem remover histórico",async()=>{
    expect((await activateProfessional("a","ownerA","p1",false)).status).toBe(200);
    expect((await getFirestore(adminApp).doc("tenants/a/professionals/p1").get()).data()?.active).toBe(false);
    expect((await activateProfessional("a","ownerA","p1",true)).status).toBe(200);
    const counter=(await getFirestore(adminApp).doc("tenants/a/usage/staff").get()).data();
    expect(counter?.professionalsActive).toBe(1);
  });
  it("não permite desativar profissional com booking futuro confirmado",async()=>{
    expect((await book("a","2026-11-03T14:00:00")).status).toBe(201);
    expect((await activateProfessional("a","ownerA","p1",false)).status).toBe(409);
  });
  it("não permite reativar profissional acima do teto após downgrade",async()=>{
    const created=await create("a","ownerA","Segunda manicure");
    expect(created.status).toBe(201);
    const body=await created.json() as {professional:{id:string}};
    expect((await activateProfessional("a","ownerA",body.professional.id,false)).status).toBe(200);
    await getFirestore(adminApp).doc("tenants/a").update({commercial:{planId:"essencial",subscriptionStatus:"active"}});
    expect((await activateProfessional("a","ownerA",body.professional.id,true)).status).toBe(409);
    expect((await getFirestore(adminApp).doc(`tenants/a/professionals/${body.professional.id}`).get()).exists).toBe(true);
  });
  it("owner A não pode alterar profissional em B",async()=>{
    expect((await activateProfessional("b","ownerA","p1",false)).status).toBe(403);
  });
  async function configureHours(uid:string,weekday:number,options:Record<string,unknown>={}){
    return worker.fetch(new Request("http://worker.local/api/admin/professionals/schedule",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(uid)}`},
      body:JSON.stringify({tenantId:"a",professionalId:"p1",weekday,closed:false,startMinute:600,endMinute:960,
        breakStartMinute:720,breakEndMinute:780,...options}),
    }),env());
  }
  async function available(date="2026-11-03"){
    const response=await worker.fetch(new Request(
      `http://worker.local/api/availability?tenantId=a&serviceId=s1&professionalId=p1&date=${date}`),env());
    expect(response.status).toBe(200);
    return (await response.json() as {slots:string[]}).slots;
  }
  it("expediente customizado filtra slots e revalida reserva no servidor",async()=>{
    expect((await configureHours("ownerA",2)).status).toBe(200);
    const slots=await available();
    expect(slots).toContain("2026-11-03T10:00:00");
    expect(slots).not.toContain("2026-11-03T09:00:00");
    expect(slots).not.toContain("2026-11-03T11:30:00");
    expect(slots).not.toContain("2026-11-03T17:00:00");
    expect((await book("a","2026-11-03T09:00:00")).status).toBe(409);
    expect((await book("a","2026-11-03T10:00:00")).status).toBe(201);
  });
  it("dia fechado não oferece horário e não confirma reserva",async()=>{
    expect((await configureHours("ownerA",2,{closed:true})).status).toBe(200);
    expect(await available()).toEqual([]);
    expect((await book("a","2026-11-03T14:00:00")).status).toBe(409);
  });
  it("não remove expediente de agendamentos futuros nem concede acesso cruzado",async()=>{
    expect((await book("a","2026-11-03T14:00:00")).status).toBe(201);
    expect((await configureHours("ownerA",2,{closed:true})).status).toBe(409);
    expect((await configureHours("ownerB",2)).status).toBe(403);
    expect((await configureHours("ownerA",2,{startMinute:900,endMinute:600})).status).toBe(400);
  });
  it("mudança de expediente preserva documentos e cria log de auditoria",async()=>{
    expect((await configureHours("ownerA",2)).status).toBe(200);
    const pro=(await getFirestore(adminApp).doc("tenants/a/professionals/p1").get()).data();
    expect(pro?.weeklyHours?.["2"]?.startMinute).toBe(600);
    expect(pro?.weeklyHours?.["2"]?.endMinute).toBe(960);
    const log=await getFirestore(adminApp).collection("tenants/a/auditLogs").get();
    expect(log.size).toBe(1);
    expect(log.docs[0].data().action).toBe("professionals.schedule_update");
  });

  async function moveBooking(appointmentId:string,startsAt:string,uid="ownerA",tenantId="a"){
    return worker.fetch(new Request("http://worker.local/api/admin/appointments/reschedule",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(uid)}`},
      body:JSON.stringify({tenantId,appointmentId,startsAt}),
    }),env());
  }
  it("remarca atomicamente: preço snapshot intacto, locks e audit atualizados",async()=>{
    const original=await book("a","2026-11-03T14:00:00");
    expect(original.status).toBe(201);
    const body=await original.json() as {appointment:{id:string}};
    expect((await moveBooking(body.appointment.id,"2026-11-03T16:00:00")).status).toBe(200);
    const db=getFirestore(adminApp);
    const moved=(await db.doc(`tenants/a/appointments/${body.appointment.id}`).get()).data();
    expect(moved?.startsAt).toBe("2026-11-03T16:00:00");
    expect(moved?.priceSnapshotCents).toBe(4000);
    expect(moved?.durationSnapshotMin).toBe(60);
    const oldLock=(await db.doc("tenants/a/bookingLocks/p1_2026-11-03_840").get()).exists;
    const newLock=(await db.doc("tenants/a/bookingLocks/p1_2026-11-03_960").get()).data();
    expect(oldLock).toBe(false);
    expect(newLock?.appointmentId).toBe(body.appointment.id);
    const audit=await db.collection("tenants/a/auditLogs").get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0].data().action).toBe("appointments.reschedule");
    expect((await book("a","2026-11-03T14:00:00")).status).toBe(201);
    expect((await book("a","2026-11-03T16:00:00")).status).toBe(409);
  });
  it("remarca horário sobreposto aos locks próprios sem criar duplicatas",async()=>{
    const original=await book("a","2026-11-03T14:00:00");
    expect(original.status).toBe(201);
    const body=await original.json() as {appointment:{id:string}};
    expect((await moveBooking(body.appointment.id,"2026-11-03T14:30:00")).status).toBe(200);
    const locks=await getFirestore(adminApp).collection("tenants/a/bookingLocks").get();
    expect(locks.size).toBe(4);
    expect(locks.docs.every(doc=>doc.data().appointmentId===body.appointment.id)).toBe(true);
  });
  it("não remarca para slot ocupado nem concede permissão cross tenant",async()=>{
    const first=await book("a","2026-11-03T14:00:00");
    expect(first.status).toBe(201);
    expect((await book("a","2026-11-03T16:00:00")).status).toBe(201);
    const id=(await first.json() as {appointment:{id:string}}).appointment.id;
    expect((await moveBooking(id,"2026-11-03T16:00:00")).status).toBe(409);
    expect((await moveBooking(id,"2026-11-03T15:00:00","ownerB")).status).toBe(403);
    const stored=(await getFirestore(adminApp).doc(`tenants/a/appointments/${id}`).get()).data();
    expect(stored?.startsAt).toBe("2026-11-03T14:00:00");
  });
  async function createBlock(uid="ownerA",extra:Record<string,unknown>={}){
    return worker.fetch(new Request("http://worker.local/api/admin/schedule-blocks/create",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(uid)}`},
      body:JSON.stringify({tenantId:"a",professionalId:"p1",
        startsAt:"2026-11-03T15:00:00",endsAt:"2026-11-03T16:00:00",reason:"Folga teste",...extra}),
    }),env());
  }
  async function cancelBlock(id:string,uid="ownerA"){
    return worker.fetch(new Request("http://worker.local/api/admin/schedule-blocks/cancel",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(uid)}`},
      body:JSON.stringify({tenantId:"a",professionalId:"p1",blockId:id}),
    }),env());
  }
  it("bloqueio de folga remove disponibilidade; cancelar reabre horário",async()=>{
    const result=await createBlock();expect(result.status).toBe(201);
    const {blockId}=await result.json() as {blockId:string};
    const available=async()=>{
      const response=await worker.fetch(new Request("http://worker.local/api/availability?tenantId=a&serviceId=s1&professionalId=p1&date=2026-11-03"),env());
      return (await response.json() as {slots:string[]}).slots;
    };
    expect(await available()).not.toContain("2026-11-03T15:00:00");
    expect((await book("a","2026-11-03T15:00:00")).status).toBe(409);
    expect((await cancelBlock(blockId)).status).toBe(200);
    expect(await available()).toContain("2026-11-03T15:00:00");
    expect((await book("a","2026-11-03T15:00:00")).status).toBe(201);
    const logs=await getFirestore(adminApp).collection("tenants/a/auditLogs").get();
    expect(logs.size).toBe(2);
  });
  it("folga sobre reserva existente é negada; outro tenant não pode bloquear",async()=>{
    expect((await book("a","2026-11-03T15:00:00")).status).toBe(201);
    expect((await createBlock()).status).toBe(409);
    expect((await createBlock("ownerB")).status).toBe(403);
    expect((await createBlock("ownerA",{endsAt:"2026-11-02T12:00:00"})).status).toBe(400);
  });
  async function saveBrand(uid:string,extra:Record<string,unknown>={}){
    return worker.fetch(new Request("http://worker.local/api/admin/tenants/branding",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(uid)}`},
      body:JSON.stringify({tenantId:"a",name:"Studio Teste",
        branding:{primary:"#522277",accent:"#aabbcc",background:"#ffffff",logoText:"ST"},
        contact:{whatsapp:"5517999999999",instagram:"studio.teste"},...extra}),
    }),env());
  }
  it("tenant owner edita branding com CAS e preserva assinatura comercial",async()=>{
    expect((await saveBrand("ownerA")).status).toBe(200);
    const tenant=(await getFirestore(adminApp).doc("tenants/a").get()).data();
    expect(tenant?.name).toBe("Studio Teste");
    expect(tenant?.branding.primary).toBe("#522277");
    expect(tenant?.commercial.planId).toBe("pro");
    const logs=await getFirestore(adminApp).collection("tenants/a/auditLogs").get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0].data().action).toBe("tenant.branding_update");
  });
  it("não aceita cor inválida nem grava branding em tenant de outro owner",async()=>{
    expect((await saveBrand("ownerA",{branding:{primary:"javascript:alert(1)",accent:"#ffffff",background:"#ffffff",logoText:"ST"}})).status).toBe(400);
    expect((await saveBrand("ownerB")).status).toBe(403);
  });
  async function exportAppointments(uid:string,tenantId="a"){
    return worker.fetch(new Request("http://worker.local/api/admin/exports/appointments",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(uid)}`},
      body:JSON.stringify({tenantId}),
    }),env());
  }
  it("exporta CSV privado com cabeçalhos, BOM e log sem dados pessoais",async()=>{
    await getFirestore(adminApp).doc("tenants/a/appointments/formula").set({
      tenantId:"a",professionalId:"p1",serviceId:"s1",startsAt:"2026-11-03T10:00:00",
      endsAt:"2026-11-03T11:00:00",status:"completed",
      customerName:"=HYPERLINK(\"https://unsafe\")",customerPhone:"5517999999999",
      priceSnapshotCents:4000,durationSnapshotMin:60,
    });
    const result=await exportAppointments("ownerA");
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toContain("text/csv");
    expect(result.headers.get("cache-control")).toBe("no-store");
    const csv=await result.text();
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("customerName");
    expect(csv).toContain("'=HYPERLINK");
    const logs=await getFirestore(adminApp).collection("tenants/a/auditLogs").get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0].data().recordCount).toBe(1);
    expect(JSON.stringify(logs.docs[0].data())).not.toContain("5517999999999");
  });
  it("não exporta dados do Tenant B para owner A",async()=>{
    expect((await exportAppointments("ownerA","b")).status).toBe(403);
  });
  async function editPro(uid:string,changes:Record<string,unknown>={}){
    return worker.fetch(new Request("http://worker.local/api/admin/professionals/edit",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await signedToken(uid)}`},
      body:JSON.stringify({tenantId:"a",professionalId:"p1",name:"Novo nome",
        serviceIds:["s1"],...changes}),
    }),env());
  }
  it("editar profissional altera nome/serviços sem mexer na quota e audita",async()=>{
    const result=await editPro("ownerA");
    expect(result.status).toBe(200);
    const db=getFirestore(adminApp);
    const pro=(await db.doc("tenants/a/professionals/p1").get()).data();
    expect(pro?.name).toBe("Novo nome");
    expect(pro?.active).toBe(true);
    const count=await db.collection("tenants/a/professionals").get();
    expect(count.size).toBe(1);
    const logs=await db.collection("tenants/a/auditLogs").get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0].data().action).toBe("professionals.edit");
  });
  it("não remove serviço de agendamento futuro nem permite acesso de B",async()=>{
    expect((await book("a","2026-11-03T14:00:00")).status).toBe(201);
    expect((await editPro("ownerA",{serviceIds:[]})).status).toBe(409);
    expect((await editPro("ownerB")).status).toBe(403);
    expect((await editPro("ownerA",{serviceIds:["service-id-inexistente"]})).status).toBe(400);
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
  it("não marca no-show antes do horário agendado",async()=>{
    const created=await book("a","2026-11-03T14:00:00");
    expect(created.status).toBe(201);
    const id=(await created.json() as {appointment:{id:string}}).appointment.id;
    const token=await signedToken("ownerA");
    const update=async (status:string)=>worker.fetch(new Request("http://worker.local/api/admin/appointments/status",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},
      body:JSON.stringify({tenantId:"a",appointmentId:id,status}),
    }),env());
    expect((await update("confirmed")).status).toBe(200);
    expect((await update("no_show")).status).toBe(409);
    expect((await getFirestore(adminApp).doc(`tenants/a/appointments/${id}`).get()).data()?.status).toBe("confirmed");
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

describe("Firebase Auth Emulator end-to-end local-only",()=>{
  const localProject="manicure-demo";
  let localApp:App;
  let localToken="";
  beforeAll(async()=>{
    process.env.FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099";
    localApp=initializeApp({projectId:localProject},"local-emulator-auth");
    const auth=getAuth(localApp);
    try{
      await auth.createUser({uid:"local-owner-a",email:"local-owner-a@example.test",
        password:"DemoLocalTest123!",emailVerified:true});
    }catch(error){
      const code=(error as {code?:string}).code;
      if(code!=="auth/uid-already-exists"&&code!=="auth/email-already-exists")throw error;
    }
    const db=getFirestore(localApp);
    await db.doc("tenants/local-a").set({name:"Local A",status:"active",kind:"demo",
      commercial:{planId:"pro",subscriptionStatus:"active"}});
    await db.doc("tenants/local-a/services/manicure").set({name:"Manicure",tenantId:"local-a",
      priceCents:4000,durationMin:60,active:true});
    await db.doc("tenants/local-b").set({name:"Local B",status:"active",kind:"demo",
      commercial:{planId:"pro",subscriptionStatus:"active"}});
    await db.doc("tenants/local-b/services/manicure").set({name:"Manicure",tenantId:"local-b",
      priceCents:4000,durationMin:60,active:true});
    await db.doc("memberships/local-a_local-owner-a").set({userId:"local-owner-a",
      tenantId:"local-a",status:"active",role:"tenant_owner"});
    const response=await fetch(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({email:"local-owner-a@example.test",password:"DemoLocalTest123!",returnSecureToken:true}),
      });
    if(!response.ok)throw new Error("Auth Emulator signInWithPassword failed: "+response.status);
    localToken=(await response.json() as {idToken:string}).idToken;
  });
  afterAll(async()=>{if(localApp)await deleteApp(localApp);});
  const emulatorEnv=()=>({
    FIREBASE_PROJECT_ID:localProject,FIREBASE_CLIENT_EMAIL:"none@local.invalid",
    FIREBASE_PRIVATE_KEY:"none",FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",ALLOWED_ORIGIN:"http://localhost:5173",
  });
  async function create(tenantId:string,envOverride:Record<string,string>={}){
    return worker.fetch(new Request("http://worker.local/api/admin/professionals",{
      method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${localToken}`},
      body:JSON.stringify({tenantId,name:"Manicure teste",serviceIds:["manicure"]}),
    }),{...emulatorEnv(),...envOverride});
  }
  it("aceita sessão REAL emitida pelo Auth Emulator local para o Tenant A",async()=>{
    expect((await create("local-a")).status).toBe(201);
  });
  it("não libera Tenant B com sessão do Owner A",async()=>{
    expect((await create("local-b")).status).toBe(403);
  });
  it("não habilita bypass de Auth Emulator sem guarda de projeto sintético",async()=>{
    expect((await create("local-a",{FIREBASE_PROJECT_ID:"projeto-real-nao-sintetico"})).status).toBe(403);
  });
});
