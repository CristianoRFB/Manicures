import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import fs from "node:fs";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "manicure-rules-test", firestore: { rules: fs.readFileSync("firestore.rules", "utf8") } });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "tenants/a"), { slug:"a", name:"A", status:"active", kind:"demo" });
    await setDoc(doc(db, "tenants/b"), { slug:"b", name:"B", status:"active", kind:"demo" });
    await setDoc(doc(db, "tenantSlugs/a"), { tenantId:"a", status:"active" });
    await setDoc(doc(db, "tenantSlugs/b"), { tenantId:"b", status:"active" });
    await setDoc(doc(db, "memberships/a_ownerA"), { userId:"ownerA", tenantId:"a", role:"tenant_owner", status:"active" });
    await setDoc(doc(db, "memberships/b_ownerB"), { userId:"ownerB", tenantId:"b", role:"tenant_owner", status:"active" });
    await setDoc(doc(db, "memberships/a_disabled"), { userId:"disabled", tenantId:"a", role:"tenant_owner", status:"disabled" });
    await setDoc(doc(db, "platformUsers/platform"), { role:"platform_owner", status:"active" });
    await setDoc(doc(db, "tenants/a/services/s1"), { tenantId:"a", name:"S", priceCents:1000, durationMin:60, active:true });
  });
});

describe("tenant isolation", () => {
  it("owner A lê A e não lê B privado", async () => {
    const dbA = env.authenticatedContext("ownerA").firestore();
    await assertSucceeds(getDoc(doc(dbA, "tenants/a")));
    await assertFails(getDoc(doc(dbA, "tenants/b/appointments/secret")));
  });

  it("membership disabled não ganha acesso privado", async () => {
    const db = env.authenticatedContext("disabled").firestore();
    await assertFails(getDoc(doc(db, "tenants/a/appointments/secret")));
  });

  it("platform owner possui acesso global explícito", async () => {
    const db = env.authenticatedContext("platform").firestore();
    await assertSucceeds(getDoc(doc(db, "tenants/a")));
    await assertSucceeds(getDoc(doc(db, "tenants/b")));
  });

  it("cliente público não cria Appointment direto no Firestore", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "tenants/a/appointments/x"), { tenantId:"a", status:"pending" }));
  });

  it("tenant suspenso deixa de ser público", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), "tenants/a"), { slug:"a", name:"A", status:"suspended", kind:"demo" }));
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "tenants/a")));
  });
});
