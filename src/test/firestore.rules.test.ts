import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import fs from "node:fs";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "manicure-rules-test", firestore: { rules: fs.readFileSync("firestore.rules", "utf8") } });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "tenants/a"), { slug:"a", name:"A", status:"active", kind:"demo" });
    await setDoc(doc(db, "tenants/b"), { slug:"b", name:"B", status:"active", kind:"demo" });
    await setDoc(doc(db, "tenantSlugs/a"), { tenantId:"a", status:"active" });
    await setDoc(doc(db, "tenantSlugs/b"), { tenantId:"b", status:"active" });
    await setDoc(doc(db, "memberships/a_ownerA"), { userId:"ownerA", tenantId:"a", role:"tenant_owner", status:"active" });
    await setDoc(doc(db, "memberships/a_adminA"), { userId:"adminA", tenantId:"a", role:"tenant_admin", status:"active" });
    await setDoc(doc(db, "memberships/a_proA"), { userId:"proA", tenantId:"a", role:"professional", status:"active", professionalId:"p1" });
    await setDoc(doc(db, "memberships/a_customerA"), { userId:"customerA", tenantId:"a", role:"customer", status:"active", customerId:"c1" });
    await setDoc(doc(db, "memberships/b_ownerB"), { userId:"ownerB", tenantId:"b", role:"tenant_owner", status:"active" });
    await setDoc(doc(db, "memberships/a_disabled"), { userId:"disabled", tenantId:"a", role:"tenant_owner", status:"disabled" });
    await setDoc(doc(db, "platformUsers/platform"), { role:"platform_owner", status:"active" });
    await setDoc(doc(db, "tenants/a/services/s1"), { tenantId:"a", name:"S", priceCents:1000, durationMin:60, active:true });
    await setDoc(doc(db, "tenants/b/services/s1"), { tenantId:"b", name:"B S", priceCents:1200, durationMin:60, active:true });
    await setDoc(doc(db, "tenants/a/appointments/own"), { tenantId:"a", professionalId:"p1", status:"confirmed" });
    await setDoc(doc(db, "tenants/a/appointments/other"), { tenantId:"a", professionalId:"p2", status:"confirmed" });
    await setDoc(doc(db, "tenants/b/appointments/b1"), { tenantId:"b", professionalId:"pb", status:"confirmed" });
  });
});

describe("tenant isolation and RBAC", () => {
  it("owner A lê A e não lê B privado", async () => {
    const dbA = env.authenticatedContext("ownerA").firestore();
    await assertSucceeds(getDoc(doc(dbA, "tenants/a")));
    await assertSucceeds(getDoc(doc(dbA, "tenants/a/appointments/own")));
    await assertFails(getDoc(doc(dbA, "tenants/b/appointments/b1")));
  });

  it("tenant admin A administra A mas não B", async () => {
    const db = env.authenticatedContext("adminA").firestore();
    await assertSucceeds(setDoc(doc(db, "tenants/a/services/new"), { tenantId:"a", name:"Novo", priceCents:1000, durationMin:30, active:true }));
    await assertFails(setDoc(doc(db, "tenants/b/services/forged"), { tenantId:"b", name:"Forjado", priceCents:1000, durationMin:30, active:true }));
  });

  it("troca manual de tenantId/path não permite atravessar tenant", async () => {
    const db = env.authenticatedContext("ownerA").firestore();
    await assertFails(setDoc(doc(db, "tenants/b/services/forged-a"), { tenantId:"a", name:"Forjado", priceCents:1000, durationMin:30, active:true }));
  });

  it("professional lê somente appointments atribuídos a si", async () => {
    const db = env.authenticatedContext("proA").firestore();
    await assertSucceeds(getDoc(doc(db, "tenants/a/appointments/own")));
    await assertFails(getDoc(doc(db, "tenants/a/appointments/other")));
    await assertFails(getDoc(doc(db, "tenants/b/appointments/b1")));
  });

  it("customer não recebe acesso administrativo/privado por membership", async () => {
    const db = env.authenticatedContext("customerA").firestore();
    await assertFails(getDoc(doc(db, "tenants/a/appointments/own")));
    await assertFails(setDoc(doc(db, "tenants/a/services/nope"), { tenantId:"a", active:true }));
  });

  it("membership disabled não ganha acesso privado", async () => {
    const db = env.authenticatedContext("disabled").firestore();
    await assertFails(getDoc(doc(db, "tenants/a/appointments/own")));
  });

  it("platform owner possui acesso global explícito", async () => {
    const db = env.authenticatedContext("platform").firestore();
    await assertSucceeds(getDoc(doc(db, "tenants/a")));
    await assertSucceeds(getDoc(doc(db, "tenants/b")));
    await assertSucceeds(getDoc(doc(db, "tenants/b/appointments/b1")));
  });


  it("membership e professional quota não podem ser manipuladas pelo cliente", async () => {
    const db = env.authenticatedContext("platform").firestore();
    await assertFails(setDoc(doc(db,"memberships/a_bad"),{userId:"bad",tenantId:"a",role:"tenant_owner",status:"active"}));
    await assertFails(setDoc(doc(db,"tenants/a/professionals/p-extra"),{tenantId:"a",name:"Extra",active:true,serviceIds:[]}));
    await assertFails(setDoc(doc(db,"tenants/a"),{status:"active",commercial:{planId:"premium",subscriptionStatus:"active"}},{merge:true}));
  });

  it("cliente público não cria Appointment direto no Firestore", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "tenants/a/appointments/x"), { tenantId:"a", status:"pending" }));
  });

  it("assinatura suspensa bloqueia novos serviços, preserva leitura", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(),"tenants/a"),{commercial:{planId:"pro",subscriptionStatus:"suspended"}},{merge:true});
    });
    const db = env.authenticatedContext("ownerA").firestore();
    await assertSucceeds(getDoc(doc(db,"tenants/a/services/s1")));
    await assertFails(setDoc(doc(db,"tenants/a/services/s2"),{tenantId:"a",name:"Novo",priceCents:3000,durationMin:60,active:true}));
  });

  it("trial vencido bloqueia escrita, trial futuro permite", async () => {
    const db = env.authenticatedContext("ownerA").firestore();
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(),"tenants/a"),{commercial:{planId:"pro",subscriptionStatus:"trial",trialUntil:"2020-01-01T00:00:00Z",trialUntilEpochMs:Date.parse("2020-01-01T00:00:00Z")}},{merge:true});
    });
    await assertFails(setDoc(doc(db,"tenants/a/services/s3"),{tenantId:"a",name:"Novo",priceCents:3000,durationMin:60,active:true}));
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(),"tenants/a"),{commercial:{planId:"pro",subscriptionStatus:"trial",trialUntil:"2090-01-01T00:00:00Z",trialUntilEpochMs:Date.parse("2090-01-01T00:00:00Z")}},{merge:true});
    });
    await assertSucceeds(setDoc(doc(db,"tenants/a/services/s3"),{tenantId:"a",name:"Novo",priceCents:3000,durationMin:60,active:true}));
  });

  it("override comercial para services.manage nega escrita no backend", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(),"tenants/a"),{commercial:{planId:"pro",subscriptionStatus:"active",entitlementOverrides:{"services.manage":false}}},{merge:true});
    });
    const db=env.authenticatedContext("ownerA").firestore();
    await assertFails(setDoc(doc(db,"tenants/a/services/s4"),{tenantId:"a",name:"Bloqueado",priceCents:2000,durationMin:60,active:true}));
  });

  it("admin pode atualizar e arquivar serviço preservando tenantId; cliente não pode",async()=>{
    const owner=env.authenticatedContext("ownerA").firestore();
    await assertSucceeds(setDoc(doc(owner,"tenants/a/services/s1"),{
      tenantId:"a",name:"Novo preço",priceCents:2200,durationMin:60,active:false
    }));
    await assertFails(setDoc(doc(owner,"tenants/a/services/s1"),{
      tenantId:"b",name:"Troca tenant",priceCents:2200,durationMin:60,active:true
    }));
    const publicDb=env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(publicDb,"tenants/a/services/s1")));
    const customer=env.authenticatedContext("customerA").firestore();
    await assertFails(setDoc(doc(customer,"tenants/a/services/s1"),{
      tenantId:"a",name:"Fraude",priceCents:100,durationMin:60,active:true
    }));
  });

  it("só Worker pode criar ou cancelar bloqueio de agenda",async()=>{
    const db=env.authenticatedContext("ownerA").firestore();
    await assertFails(setDoc(doc(db,"tenants/a/scheduleBlocks/forjado"),{
      tenantId:"a",professionalId:"p1",startsAt:"2026-11-03T15:00:00",
      endsAt:"2026-11-03T16:00:00",active:true,
    }));
  });
  it("tenant suspenso bloqueia público e membership do tenant", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), "tenants/a"), { slug:"a", name:"A", status:"suspended", kind:"demo" }));
    const publicDb = env.unauthenticatedContext().firestore();
    const ownerDb = env.authenticatedContext("ownerA").firestore();
    const platformDb = env.authenticatedContext("platform").firestore();
    await assertFails(getDoc(doc(publicDb, "tenants/a")));
    await assertFails(getDoc(doc(ownerDb, "tenants/a/appointments/own")));
    await assertSucceeds(getDoc(doc(platformDb, "tenants/a")));
  });
});
