import {describe,expect,it} from "vitest";
import {DemoRepository,selectRepository} from "./repository";
import {FirestoreRepository,withId} from "./firestoreRepository";

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

describe("Firestore document identity",()=>{
  it("keeps the authoritative document path ID even when stored fields contain an ID",()=>{
    const row=withId<{id:string;tenantId:string}>("actual-document-id",{
      id:"another-tenant-id",tenantId:"tenant-a",
    });
    expect(row.id).toBe("actual-document-id");
    expect(row.tenantId).toBe("tenant-a");
  });
});
