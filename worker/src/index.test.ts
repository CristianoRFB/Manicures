import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
    db.doc("tenants/a").set({ slug:"a", name:"A", status:"active", kind:"demo" }),
    db.doc("tenants/a/services/s1").set({ tenantId:"a", name:"Manicure", priceCents:4000, durationMin:60, active:true }),
    db.doc("tenants/a/professionals/p1").set({ tenantId:"a", name:"Profissional A", active:true, serviceIds:["s1"] }),
    db.doc("tenants/b").set({ slug:"b", name:"B", status:"active", kind:"demo" }),
    db.doc("tenants/b/services/s1").set({ tenantId:"b", name:"Manicure B", priceCents:5000, durationMin:60, active:true }),
    db.doc("tenants/b/professionals/p1").set({ tenantId:"b", name:"Profissional B", active:true, serviceIds:["s1"] }),
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
