import type { Appointment, Professional, Service, Tenant } from "../domain/types";
import { addMinutes } from "../domain/availability";
import { studioCalendarDate } from "../domain/localCalendarDate";

export const demoTenant: Tenant = {
  id: "tenant-demo-a",
  slug: "demo",
  name: "Studio Demo Nails A — DEMONSTRAÇÃO",
  status: "active",
  kind: "demo",
  commercial: {planId:"premium_demo",subscriptionStatus:"demo"},
  branding: { primary: "#5b2b73", accent: "#d49adf", background: "#fff9ff", logoText: "DA" },
  contact: {},
  businessSettings: { timezone: "America/Sao_Paulo", bookingHorizonDays: 45, minLeadMinutes: 60 },
};

export const demoTenantB: Tenant = {
  id: "tenant-demo-b",
  slug: "demo-b",
  name: "Ateliê Demo B — DEMONSTRAÇÃO",
  status: "active",
  kind: "demo",
  branding: { primary: "#24476b", accent: "#90c2e7", background: "#f6fbff", logoText: "DB" },
  contact: {},
  businessSettings: { timezone: "America/Sao_Paulo", bookingHorizonDays: 30, minLeadMinutes: 90 },
};

export const demoServices: Service[] = [
  { id: "manicure-classica", tenantId: demoTenant.id, name: "Manicure clássica", description: "Cuidado das unhas e esmaltação.", priceCents: 4000, durationMin: 60, active: true },
  { id: "esmaltacao-gel", tenantId: demoTenant.id, name: "Esmaltação em gel", description: "Preparação e esmaltação em gel.", priceCents: 7000, durationMin: 90, active: true },
  { id: "pedicure-b", tenantId: demoTenantB.id, name: "Pedicure Demo B", description: "Serviço fictício isolado no Tenant B.", priceCents: 5500, durationMin: 60, active: true },
];

export const demoProfessionals: Professional[] = [
  { id: "professional-demo-a1", tenantId: demoTenant.id, name: "Profissional Demo A1", active: true, serviceIds: ["manicure-classica", "esmaltacao-gel"] },
  { id: "professional-demo-a2", tenantId: demoTenant.id, name: "Profissional Demo A2", active: true, serviceIds: ["manicure-classica"] },
  { id: "professional-demo-b1", tenantId: demoTenantB.id, name: "Profissional Demo B1", active: true, serviceIds: ["pedicure-b"] },
];

const date = studioCalendarDate("America/Sao_Paulo",1);
export const demoAppointments: Appointment[] = [
  {
    id: "appointment-demo-a1", tenantId: demoTenant.id, customerName: "Cliente Demonstração", customerPhone: "00000000000",
    professionalId: "professional-demo-a1", serviceId: "manicure-classica", startsAt: `${date}T14:00:00`,
    endsAt: addMinutes(`${date}T14:00:00`, 60), priceSnapshotCents: 4000, durationSnapshotMin: 60,
    status: "confirmed", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];
