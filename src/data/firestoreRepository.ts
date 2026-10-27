import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import type { Appointment, AuditLog, Membership, Professional, Service, Tenant } from "../domain/types";
import { getFirebaseServices } from "../lib/firebase";
import type { Repository } from "./repository";

function dbOrThrow() {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase não configurado.");
  return services.db;
}

function withId<T>(id: string, data: unknown): T {
  return { id, ...(data as object) } as T;
}

export class FirestoreRepository implements Repository {
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const db = dbOrThrow();
    const slugSnapshot = await getDoc(doc(db, "tenantSlugs", slug));
    if (!slugSnapshot.exists() || slugSnapshot.data().status !== "active") return null;
    const tenantId = slugSnapshot.data().tenantId as string;
    const tenantSnapshot = await getDoc(doc(db, "tenants", tenantId));
    if (!tenantSnapshot.exists()) return null;
    return withId<Tenant>(tenantSnapshot.id, tenantSnapshot.data());
  }

  async listTenants(): Promise<Tenant[]> {
    const snapshot = await getDocs(collection(dbOrThrow(), "tenants"));
    return snapshot.docs.map((item) => withId<Tenant>(item.id, item.data()));
  }

  async listServices(tenantId: string): Promise<Service[]> {
    const snapshot = await getDocs(query(collection(dbOrThrow(), "tenants", tenantId, "services"), where("active", "==", true)));
    return snapshot.docs.map((item) => withId<Service>(item.id, item.data()));
  }

  async listProfessionals(tenantId: string): Promise<Professional[]> {
    const snapshot = await getDocs(query(collection(dbOrThrow(), "tenants", tenantId, "professionals"), where("active", "==", true)));
    return snapshot.docs.map((item) => withId<Professional>(item.id, item.data()));
  }

  async listAppointments(tenantId: string): Promise<Appointment[]> {
    const snapshot = await getDocs(collection(dbOrThrow(), "tenants", tenantId, "appointments"));
    return snapshot.docs.map((item) => withId<Appointment>(item.id, item.data()));
  }

  async getMembership(tenantId: string, userId: string): Promise<Membership | null> {
    const snapshot = await getDoc(doc(dbOrThrow(), "memberships", `${tenantId}_${userId}`));
    return snapshot.exists() ? withId<Membership>(snapshot.id, snapshot.data()) : null;
  }

  async isPlatformOwner(userId: string): Promise<boolean> {
    const snapshot = await getDoc(doc(dbOrThrow(), "platformUsers", userId));
    return snapshot.exists() && snapshot.data().role === "platform_owner" && snapshot.data().status !== "disabled";
  }

  async recordAuditLog(log: AuditLog): Promise<void> {
    await setDoc(doc(dbOrThrow(), "tenants", log.tenantId, "auditLogs", log.id), log);
  }
}
