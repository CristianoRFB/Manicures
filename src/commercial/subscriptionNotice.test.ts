import {describe,it,expect} from "vitest";
import type {Tenant} from "../domain/types";
import {subscriptionNotice} from "./subscriptionNotice";
const base={status:"active",kind:"real",commercial:{planId:"pro",subscriptionStatus:"trial",
  trialUntil:"2026-11-02T00:00:00.000Z"}} as Tenant;
describe("commercial operational notices",()=>{
  it("shows remaining trial without altering the approved 14-day contract",()=>{
    const notice=subscriptionNotice(base,new Date("2026-10-29T00:00:00.000Z"));
    expect(notice.level).toBe("ok");
    expect(notice.message).toContain("4 dia(s)");
    expect(notice.message).toContain("Sem cobrança automática");
  });
  it("warns near expiration, blocks expired and invalid trials",()=>{
    expect(subscriptionNotice(base,new Date("2026-10-31T01:00:00.000Z")).level).toBe("warning");
    expect(subscriptionNotice(base,new Date("2026-11-02T00:00:00.000Z")).level).toBe("blocked");
    expect(subscriptionNotice({...base,commercial:{...base.commercial!,trialUntil:null}},new Date("2026-10-29T00:00:00.000Z")).level).toBe("blocked");
  });
  it("states suspended and past_due restrictions without implying billing",()=>{
    expect(subscriptionNotice({...base,status:"suspended"}).level).toBe("blocked");
    expect(subscriptionNotice({...base,commercial:{...base.commercial!,subscriptionStatus:"past_due"}}).message).toContain("Nenhuma cobrança");
  });
});
