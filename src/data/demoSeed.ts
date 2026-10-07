import type { Appointment, Professional, Service, Tenant } from "../domain/types";
import { addMinutes } from "../domain/availability";

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const demoTenant: Tenant = {
  id: "tenant-demo",
  slug: "demo",
  name: "Studio Demo Nails — DEMONSTRAÇÃO",
  status: "active",
  kind: "demo",
  branding: {
    primary: "#5b2b73",
    accent: "#d49adf",
    background: "#fff9ff",
    logoText: "DN",
  },
  contact: {},
  businessSettings: {
    timezone: "America/Sao_Paulo",
    bookingHorizonDays: 45,
    minLeadMinutes: 60,
  },
};

export const demoServices: Service[] = [
  {
    id: "manicure-classica",
    tenantId: demoTenant.id,
    name: "Manicure clássica",
    description: "Cuidado das unhas e esmaltação.",
    priceCents: 4000,
    durationMin: 60,
    active: true,
  },
  {
    id: "esmaltacao-gel",
    tenantId: demoTenant.id,
    name: "Esmaltação em gel",
    description: "Preparação e esmaltação em gel.",
    priceCents: 7000,
    durationMin: 90,
    active: true,
  },
];

export const demoProfessionals: Professional[] = [
  {
    id: "professional-demo-a",
    tenantId: demoTenant.id,
    name: "Profissional Demo A",
    active: true,
    serviceIds: demoServices.map((s) => s.id),
  },
  {
    id: "professional-demo-b",
    tenantId: demoTenant.id,
    name: "Profissional Demo B",
    active: true,
    serviceIds: ["manicure-classica"],
  },
];

const date = tomorrow();
export const demoAppointments: Appointment[] = [
  {
    id: "appointment-demo-1",
    tenantId: demoTenant.id,
    customerName: "Cliente Demonstração",
    customerPhone: "00000000000",
    professionalId: "professional-demo-a",
    serviceId: "manicure-classica",
    startsAt: `${date}T14:00:00`,
    endsAt: addMinutes(`${date}T14:00:00`, 60),
    priceSnapshotCents: 4000,
    durationSnapshotMin: 60,
    status: "confirmed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
