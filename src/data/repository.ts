import type { Appointment, AuditLog, Membership, Professional, Service, Tenant } from "../domain/types";
import { demoModeEnabled, firebaseConfigured } from "../lib/firebase";
import { demoAppointments, demoProfessionals, demoServices, demoTenant, demoTenantB } from "./demoSeed";
import { FirestoreRepository } from "./firestoreRepository";

export interface Repository {
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  listTenants(): Promise<Tenant[]>;
  listServices(tenantId: string): Promise<Service[]>;
  createService(tenantId: string, input: Pick<Service, "name" | "description" | "priceCents" | "durationMin">): Promise<Service>;
  listProfessionals(tenantId: string, options?: {includeInactive?: boolean}): Promise<Professional[]>;
  listAppointments(tenantId: string): Promise<Appointment[]>;
  getMembership(tenantId: string, userId: string): Promise<Membership | null>;
  isPlatformOwner(userId: string): Promise<boolean>;
  recordAuditLog(log: AuditLog): Promise<void>;
}

const APPOINTMENTS_KEY = "saas-manicure:demo:appointments";

function readStoredAppointments(): Appointment[] {
  if (typeof localStorage === "undefined") return demoAppointments;
  const raw = localStorage.getItem(APPOINTMENTS_KEY);
  if (!raw) {
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(demoAppointments));
    return demoAppointments;
  }
  try { return JSON.parse(raw) as Appointment[]; } catch { return demoAppointments; }
}

export class DemoRepository implements Repository {
  async getTenantBySlug(slug: string) {
    return [demoTenant, demoTenantB].find((tenant) => tenant.slug === slug) ?? null;
  }
  async listTenants() { return [demoTenant, demoTenantB]; }
  async listServices(tenantId: string) { return demoServices.filter((item) => item.tenantId === tenantId); }
  async createService(): Promise<Service> { throw new Error("Administração exige Firebase Auth/Firestore; demo local é só leitura."); }
  async listProfessionals(tenantId: string, options?: {includeInactive?: boolean}) { return demoProfessionals.filter((item) => item.tenantId === tenantId && (options?.includeInactive || item.active)); }
  async listAppointments(tenantId: string) { return readStoredAppointments().filter((item) => item.tenantId === tenantId); }
  async getMembership() { return null; }
  async isPlatformOwner() { return false; }
  async recordAuditLog() { /* demo local não é evidência de auditoria real */ }
}

function createRepository(): Repository {
  if (firebaseConfigured() && !demoModeEnabled()) return new FirestoreRepository();
  return new DemoRepository();
}

export const repository: Repository = createRepository();
