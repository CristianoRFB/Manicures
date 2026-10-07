export type TenantStatus = "active" | "suspended";
export type Role = "platform_owner" | "tenant_owner" | "tenant_admin" | "professional" | "customer";
export type MembershipStatus = "active" | "disabled";
export type AppointmentStatus = "pending" | "confirmed" | "in_service" | "completed" | "cancelled" | "no_show";

export type FutureCommercialState = {
  planId?: string;
  subscriptionStatus?: "trial" | "active" | "past_due" | "suspended" | "cancelled" | "demo";
  trialUntil?: string | null;
  entitlementOverrides?: Record<string, boolean>;
  limitOverrides?: Record<string, number | null>;
};

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  kind: "demo" | "real";
  branding: {
    primary: string;
    accent: string;
    background: string;
    logoText: string;
  };
  contact: {
    whatsapp?: string;
    instagram?: string;
  };
  businessSettings: {
    timezone: string;
    bookingHorizonDays: number;
    minLeadMinutes: number;
  };
  commercial?: FutureCommercialState;
}

export interface Membership {
  id: string;
  userId: string;
  tenantId: string;
  role: Role;
  status: MembershipStatus;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  priceCents: number;
  durationMin: number;
  active: boolean;
}

export interface Professional {
  id: string;
  tenantId: string;
  name: string;
  active: boolean;
  serviceIds: string[];
}

export interface Appointment {
  id: string;
  tenantId: string;
  customerName: string;
  customerPhone: string;
  professionalId: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  priceSnapshotCents: number;
  durationSnapshotMin: number;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
