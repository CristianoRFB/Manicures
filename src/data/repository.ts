import type { Appointment, AuditLog, Membership, Professional, Service, ScheduleBlock, Tenant } from "../domain/types";
import { demoModeEnabled } from "../lib/firebase";
import { demoAppointments, demoProfessionals, demoServices, demoTenant, demoTenantB } from "./demoSeed";
import { FirestoreRepository } from "./firestoreRepository";

export interface Repository {
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  listTenants(): Promise<Tenant[]>;
  listServices(tenantId: string, options?: {includeInactive?: boolean}): Promise<Service[]>;
  updateService(tenantId: string, serviceId: string, change: Pick<Service,"name"|"description"|"priceCents"|"durationMin"|"active">): Promise<void>;
  createService(tenantId: string, input: Pick<Service, "name" | "description" | "priceCents" | "durationMin">): Promise<Service>;
  listProfessionals(tenantId: string, options?: {includeInactive?: boolean}): Promise<Professional[]>;
  listAppointments(tenantId: string): Promise<Appointment[]>;
  listAppointmentsForProfessional(tenantId: string, professionalId: string): Promise<Appointment[]>;
  listAppointmentsForCustomer(tenantId: string, customerId: string): Promise<Appointment[]>;
  listScheduleBlocks(tenantId: string): Promise<ScheduleBlock[]>;
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
  async listServices(tenantId: string, options?: {includeInactive?: boolean}) { return demoServices.filter((item) => item.tenantId === tenantId && (options?.includeInactive || item.active)); }
  async updateService(): Promise<void> { throw new Error("Demo local não altera serviços."); }
  async createService(): Promise<Service> { throw new Error("Administração exige Firebase Auth/Firestore; demo local é só leitura."); }
  async listProfessionals(tenantId: string, options?: {includeInactive?: boolean}) { return demoProfessionals.filter((item) => item.tenantId === tenantId && (options?.includeInactive || item.active)); }
  async listAppointments(tenantId: string) { return readStoredAppointments().filter((item) => item.tenantId === tenantId); }
  async listAppointmentsForCustomer(tenantId:string,customerId:string){
    return readStoredAppointments().filter(item=>item.tenantId===tenantId&&item.customerId===customerId);
  }
  async listAppointmentsForProfessional(tenantId:string,professionalId:string){
    return readStoredAppointments().filter(item=>item.tenantId===tenantId&&item.professionalId===professionalId);
  }
  async listScheduleBlocks():Promise<ScheduleBlock[]> {return [];} 
  async getMembership() { return null; }
  async isPlatformOwner() { return false; }
  async recordAuditLog() { /* demo local não é evidência de auditoria real */ }
}

/** Explicit demo mode is the only path to synthetic studio data.
 * With missing Firebase configuration, real repositories fail closed instead of silently
 * rendering demo tenants as if they belonged to a live studio.
 */
export function selectRepository(demoMode: boolean): Repository {
  return demoMode ? new DemoRepository() : new FirestoreRepository();
}

export const repository: Repository = selectRepository(demoModeEnabled());
