import { describe, expect, it } from "vitest";
import type { Tenant } from "../domain/types";
import { PLAN_CATALOG } from "./planCatalog";
import { assertCommercialChange, canUse, evaluate, getLimit, withinLimit } from "./entitlements";
const make = (planId: string, subscriptionStatus: "active" | "trial" | "demo" | "past_due" | "suspended" | "cancelled"="active"): Tenant => ({
 id:"t",slug:"t",name:"Test",kind: subscriptionStatus === "demo" ? "demo" : "real",status:"active",
 branding:{primary:"#000",accent:"#000",background:"#fff",logoText:"X"},contact:{},
 businessSettings:{timezone:"America/Sao_Paulo",bookingHorizonDays:30,minLeadMinutes:60},
 commercial:{planId,subscriptionStatus}
});
describe("Global Standard v01 / Manicure",()=>{
 it("valores e limites são exatamente os aprovados",()=>{
  expect([PLAN_CATALOG.essencial.monthlyPriceCents,PLAN_CATALOG.pro.monthlyPriceCents,PLAN_CATALOG.premium.monthlyPriceCents]).toEqual([4990,7990,11990]);
  expect([PLAN_CATALOG.essencial.annualPriceCents,PLAN_CATALOG.pro.annualPriceCents,PLAN_CATALOG.premium.annualPriceCents]).toEqual([49900,79900,119900]);
  expect(["essencial","pro","premium"].map(p=>getLimit(make(p),"professionals_active"))).toEqual([1,3,10]);
  expect(["essencial","pro","premium"].map(p=>getLimit(make(p),"tenant_admins"))).toEqual([0,2,5]);
 });
 it("serviço essencial permanece acessível nos três planos",()=> {
  for(const id of ["essencial","pro","premium"]) expect(canUse(make(id),"booking.create")).toBe(true);
 });
 it("NEXT/DEFERRED não é vendido como executável",()=>{
  expect(canUse(make("premium"),"cashflow")).toBe(false);
  expect(evaluate(make("pro"),"reports.basic").reason).toBe("unimplemented");
  expect(canUse(make("premium"),"reminders.automatic")).toBe(false);
 });
 it("status, trial vencido, suspended tenant",()=>{
  expect(canUse(make("essencial","past_due"),"booking.create")).toBe(false);
  expect(canUse(make("pro","cancelled"),"booking.create")).toBe(false);
  const trial=make("pro","trial"); trial.commercial!.trialUntil="2026-01-01T00:00:00Z";
  expect(canUse(trial,"booking.create",new Date("2026-10-27"))).toBe(false);
  trial.commercial!.trialUntil="2026-11-10T00:00:00Z";
  expect(canUse(trial,"booking.create",new Date("2026-10-27"))).toBe(true);
  const tenant=make("premium");tenant.status="suspended";expect(canUse(tenant,"booking.create")).toBe(false);
 });
 it("demo premium é apenas tenant fictício e não liga features ausentes",()=>{
  const demo=make("premium_demo","demo");expect(canUse(demo,"booking.create")).toBe(true);
  expect(canUse(demo,"reports.advanced")).toBe(false);
  demo.kind="real";expect(canUse(demo,"booking.create")).toBe(false);
 });
 it("override de limite e downgrade preservam leitura; bloqueiam crescimento",()=>{
  const tenant=make("premium"); expect(withinLimit(tenant,"professionals_active",9)).toBe(true);
  tenant.commercial!.planId="essencial";expect(withinLimit(tenant,"professionals_active",9)).toBe(false);
  expect(canUse(tenant,"dashboard.read")).toBe(true);
  tenant.commercial!.limitOverrides={professionals_active:12};expect(withinLimit(tenant,"professionals_active",9)).toBe(true);
  expect(getLimit(make("pro"),"customers")).toBeNull();
 });
 it("invalid overrides and invalid demo are rejected",()=>{
  expect(()=>assertCommercialChange({planId:"premium_demo",subscriptionStatus:"active"},"real")).toThrow();
  expect(()=>assertCommercialChange({planId:"essencial",subscriptionStatus:"active",entitlementOverrides:{"auth":false}},"real")).toThrow();
  expect(()=>assertCommercialChange({planId:"pro",subscriptionStatus:"active",limitOverrides:{professionals_active:-1}},"real")).toThrow();
 });
 it("legado sem plano mantém fluxo CORE existente sem criar quota fantasma",()=>{
  const t=make("essencial"); delete t.commercial;
  expect(canUse(t,"booking.create")).toBe(true);expect(getLimit(t,"professionals_active")).toBe(0);
 });
});