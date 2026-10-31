import {describe,expect,it} from "vitest";
import {DemoRepository,selectRepository} from "./repository";
import {FirestoreRepository} from "./firestoreRepository";

describe("repository selection is fail-closed",()=>{
  it("uses synthetic tenants only under explicitly enabled demo mode",async()=>{
    const demo=selectRepository(true);
    expect(demo).toBeInstanceOf(DemoRepository);
    const tenant=await demo.getTenantBySlug("demo");
    expect(tenant?.kind).toBe("demo");
  });
  it("does not use the demo as fallback in a live environment",()=>{
    expect(selectRepository(false)).toBeInstanceOf(FirestoreRepository);
  });
});
