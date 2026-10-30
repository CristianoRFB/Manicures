import { IMPLEMENTED_FEATURES, planById, type FeatureKey, type LimitKey, type PlanDefinition } from "./planCatalog";
import type { Tenant } from "../domain/types";

export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled" | "demo";
export type EntitlementReason =
  | "allowed" | "unimplemented" | "tenant_suspended" | "subscription_inactive"
  | "trial_expired" | "not_in_plan" | "overridden" | "unassigned" | "invalid_demo";

export interface Evaluation { allowed: boolean; reason: EntitlementReason; plan: PlanDefinition | null; }
export interface CommercialState {
  planId: string;
  subscriptionStatus: SubscriptionStatus;
  trialUntil?: string | null;
  entitlementOverrides?: Record<string, boolean>;
  limitOverrides?: Record<string, number | null>;
}

const CORE_COMPATIBILITY: ReadonlySet<FeatureKey> = new Set(["booking.create", "booking.public", "services.read", "branding.basic", "dashboard.read"]);
const NEVER_PAID: ReadonlySet<string> = new Set(["tenant.isolation", "security.rules", "auth", "rbac", "data.integrity", "booking.conflict_prevention"]);

/** Missing plan is a LEGACY migration state, never silently assigned a paid plan.
 * Preserve currently deployed essential operations; refuse new quota-controlled growth.
 */
export function evaluate(tenant: Tenant, feature: FeatureKey, now = new Date()): Evaluation {
  const planId = tenant.commercial?.planId === "premium_demo" ? "premium" : tenant.commercial?.planId;
  const plan = planById(planId);
  if (tenant.status !== "active") return { allowed: false, reason: "tenant_suspended", plan };
  if (!IMPLEMENTED_FEATURES.has(feature)) return { allowed: false, reason: "unimplemented", plan };
  if (!tenant.commercial?.planId || !tenant.commercial.subscriptionStatus) {
    return { allowed: CORE_COMPATIBILITY.has(feature), reason: "unassigned", plan: null };
  }
  const { subscriptionStatus, trialUntil } = tenant.commercial;
  if (subscriptionStatus === "demo") {
    if (tenant.kind !== "demo" || tenant.commercial.planId !== "premium_demo")
      return { allowed: false, reason: "invalid_demo", plan };
  } else if (tenant.commercial.planId === "premium_demo") {
    return { allowed: false, reason: "invalid_demo", plan };
  } else if (subscriptionStatus === "trial") {
    if (!trialUntil || Number.isNaN(Date.parse(trialUntil)) || Date.parse(trialUntil) <= now.getTime())
      return { allowed: false, reason: "trial_expired", plan };
  } else if (subscriptionStatus !== "active") {
    return { allowed: false, reason: "subscription_inactive", plan };
  }
  if (!plan) return { allowed: false, reason: "unassigned", plan: null };
  const override = tenant.commercial.entitlementOverrides?.[feature];
  if (override === false) return { allowed: false, reason: "overridden", plan };
  if (override === true) return { allowed: true, reason: "overridden", plan };
  return { allowed: plan.features.includes(feature), reason: plan.features.includes(feature) ? "allowed" : "not_in_plan", plan };
}
export function canUse(tenant: Tenant, feature: FeatureKey, now = new Date()): boolean {
  return evaluate(tenant, feature, now).allowed;
}
export function getLimit(tenant: Tenant, key: LimitKey, now = new Date()): number | null {
  // Null means unlimited, but only if an EXPLICIT commercial plan grants it.
  if (tenant.status !== "active" || !tenant.commercial?.subscriptionStatus) return 0;
  const status = tenant.commercial.subscriptionStatus;
  if (status !== "active" && status !== "demo" && status !== "trial") return 0;
  if (status === "trial" && (!tenant.commercial.trialUntil || Date.parse(tenant.commercial.trialUntil) <= now.getTime())) return 0;
  if (status === "demo" && (tenant.kind !== "demo" || tenant.commercial.planId !== "premium_demo")) return 0;
  if (status !== "demo" && tenant.commercial.planId === "premium_demo") return 0;
  const plan = planById(tenant.commercial.planId === "premium_demo" ? "premium" : tenant.commercial.planId);
  if (!plan) return 0;
  const override = tenant.commercial.limitOverrides?.[key];
  if (override !== undefined) {
    if (override === null) return null;
    if (Number.isSafeInteger(override) && override >= 0) return override;
    return 0; // fail closed on invalid overrides
  }
  return plan.limits[key];
}
export function withinLimit(tenant: Tenant, key: LimitKey, existing: number, additional = 1): boolean {
  const limit = getLimit(tenant, key);
  return limit !== null && limit >= 0 ? existing + additional <= limit : existing + additional >= 0;
}
export function assertCommercialChange(next: CommercialState, kind: Tenant["kind"]): void {
  if (!planById(next.planId === "premium_demo" ? "premium" : next.planId)) throw new Error("Plano inválido.");
  if (next.planId === "premium_demo" && (kind !== "demo" || next.subscriptionStatus !== "demo")) throw new Error("Demo exige tenant fictício e status demo.");
  if (next.subscriptionStatus === "demo" && next.planId !== "premium_demo") throw new Error("Status demo inválido.");
  if (next.subscriptionStatus === "trial" && (!next.trialUntil || Number.isNaN(Date.parse(next.trialUntil)))) throw new Error("Trial exige data válida.");
  if (next.subscriptionStatus !== "trial" && next.trialUntil) throw new Error("trialUntil só deve existir durante trial.");
  for (const [key,val] of Object.entries(next.entitlementOverrides ?? {})) {
    if (NEVER_PAID.has(key)) throw new Error("Fundamento CORE não pode ser alterado por override.");
    if (typeof val !== "boolean" || !IMPLEMENTED_FEATURES.has(key as FeatureKey)) throw new Error("Override de feature inválido.");
  }
  for (const [key,val] of Object.entries(next.limitOverrides ?? {})) {
    if (!["professionals_active","tenant_admins","units","customers","services","appointments"].includes(key) || (val !== null && (!Number.isSafeInteger(val) || val < 0))) throw new Error("Override de limite inválido.");
  }
}
