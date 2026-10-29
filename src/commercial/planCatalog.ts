/** Catálogo LOCAL aprovado em docs/consolidation/DECISIONS_APPROVED.md.
 * Não anuncia como disponível uma feature ainda não implementada.
 */
export type PlanId = "essencial" | "pro" | "premium";
export type FeatureKey =
  | "booking.create" | "booking.public" | "services.read" | "branding.basic"
  | "dashboard.read" | "professionals.manage" | "services.manage"
  | "appointments.manage" | "history.read" | "whatsapp.manual"
  | "reminders.automatic" | "waitlist" | "reports.basic" | "loyalty"
  | "packages" | "commissions" | "cashflow" | "inventory"
  | "reports.advanced" | "crm.advanced";
export type LimitKey = "professionals_active" | "tenant_admins" | "units" | "customers" | "services" | "appointments";
export interface PlanDefinition {
  id: PlanId;
  name: string;
  rank: number;
  monthlyPriceCents: number;
  annualPriceCents: number;
  recommended: boolean;
  features: readonly FeatureKey[];
  limits: Readonly<Record<LimitKey, number | null>>;
}

const ESSENTIAL: readonly FeatureKey[] = [
  "booking.create", "booking.public", "services.read", "branding.basic", "dashboard.read", "professionals.manage", "services.manage", "appointments.manage", "history.read", "whatsapp.manual",
];
const PRO: readonly FeatureKey[] = [...ESSENTIAL, "reminders.automatic", "waitlist", "reports.basic", "loyalty"];
const PREMIUM: readonly FeatureKey[] = [...PRO, "packages", "commissions", "cashflow", "inventory", "reports.advanced", "crm.advanced"];

/** Actual implementation flag: true ONLY if the feature works end-to-end.
 * Commercial catalog != implementation status.
 */
export const IMPLEMENTED_FEATURES: ReadonlySet<FeatureKey> = new Set([
  "booking.create", "booking.public", "services.read", "branding.basic", "dashboard.read", "services.manage", "professionals.manage", "appointments.manage",
]);

export const PLAN_CATALOG: Readonly<Record<PlanId, PlanDefinition>> = {
  essencial: {
    id: "essencial", name: "Essencial", rank: 1, monthlyPriceCents: 4990, annualPriceCents: 49900, recommended: false,
    features: ESSENTIAL,
    limits: { professionals_active: 1, tenant_admins: 0, units: 1, customers: null, services: null, appointments: null },
  },
  pro: {
    id: "pro", name: "Pro", rank: 2, monthlyPriceCents: 7990, annualPriceCents: 79900, recommended: true,
    features: PRO,
    limits: { professionals_active: 3, tenant_admins: 2, units: 1, customers: null, services: null, appointments: null },
  },
  premium: {
    id: "premium", name: "Premium", rank: 3, monthlyPriceCents: 11990, annualPriceCents: 119900, recommended: false,
    features: PREMIUM,
    limits: { professionals_active: 10, tenant_admins: 5, units: 1, customers: null, services: null, appointments: null },
  },
};
export const PLAN_ORDER: readonly PlanId[] = ["essencial", "pro", "premium"];
export function planById(id: string | undefined): PlanDefinition | null {
  return id && Object.prototype.hasOwnProperty.call(PLAN_CATALOG, id) ? PLAN_CATALOG[id as PlanId] : null;
}
