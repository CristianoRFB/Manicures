import type { Appointment, Professional, Service, Tenant } from "../domain/types";
import { demoAppointments, demoProfessionals, demoServices, demoTenant } from "./demoSeed";

export interface Repository {
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  listTenants(): Promise<Tenant[]>;
  listServices(tenantId: string): Promise<Service[]>;
  listProfessionals(tenantId: string): Promise<Professional[]>;
  listAppointments(tenantId: string): Promise<Appointment[]>;
  createAppointment(appointment: Appointment): Promise<Appointment>;
}

const APPOINTMENTS_KEY = "saas-manicure:demo:appointments";

function readStoredAppointments(): Appointment[] {
  if (typeof localStorage === "undefined") return demoAppointments;
  const raw = localStorage.getItem(APPOINTMENTS_KEY);
  if (!raw) {
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(demoAppointments));
    return demoAppointments;
  }
  try {
    return JSON.parse(raw) as Appointment[];
  } catch {
    return demoAppointments;
  }
}

export class DemoRepository implements Repository {
  async getTenantBySlug(slug: string) {
    return slug === demoTenant.slug ? demoTenant : null;
  }

  async listTenants() {
    return [demoTenant];
  }

  async listServices(tenantId: string) {
    return demoServices.filter((item) => item.tenantId === tenantId);
  }

  async listProfessionals(tenantId: string) {
    return demoProfessionals.filter((item) => item.tenantId === tenantId);
  }

  async listAppointments(tenantId: string) {
    return readStoredAppointments().filter((item) => item.tenantId === tenantId);
  }

  async createAppointment(appointment: Appointment) {
    const current = readStoredAppointments();
    const conflict = current.some(
      (item) =>
        item.tenantId === appointment.tenantId &&
        item.professionalId === appointment.professionalId &&
        ["pending", "confirmed", "in_service"].includes(item.status) &&
        appointment.startsAt < item.endsAt &&
        appointment.endsAt > item.startsAt,
    );
    if (conflict) throw new Error("Horário indisponível. Escolha outro slot.");
    const next = [...current, appointment];
    if (typeof localStorage !== "undefined") localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(next));
    return appointment;
  }
}

export const repository: Repository = new DemoRepository();
