import {describe,expect,it,vi} from "vitest";
import {deleteStoredGeneration,getStoredObject,listStoredObjects,summarizeStoragePage} from "./mediaStorage";
const env={
  FIREBASE_PROJECT_ID:"manicure-worker-test",
  FIREBASE_STORAGE_BUCKET:"manicure-worker-test.appspot.com",
  FIREBASE_STORAGE_EMULATOR_HOST:"127.0.0.1:9199",
};
const obj={name:"tenants/a/public/portfolio/photo.webp",generation:"123456",
  size:"2048",contentType:"image/webp",
  metadata:{mediaClass:"PERSISTENT_BUSINESS",metadataPolicy:"reencoded_no_exif"}};
describe("trusted Storage boundary",()=>{
  it("reads metadata with provenance, generation and tenant path",async()=>{
    const transport=vi.fn(async (_input:RequestInfo|URL,_init?:RequestInit)=>new Response(JSON.stringify(obj),{status:200}));
    const item=await getStoredObject(env,"",obj.name,transport);
    expect(item?.size).toBe(2048);
    expect(item?.metadata.mediaClass).toBe("PERSISTENT_BUSINESS");
    expect(transport.mock.calls[0][0]).toContain("127.0.0.1:9199");
    expect(transport.mock.calls[0][0]).toContain("tenants%2Fa%2Fpublic");
  });
  it("only performs DELETE with ifGenerationMatch; no arbitrary host",async()=>{
    const transport=vi.fn(async (_input:RequestInfo|URL,_init?:RequestInit)=>new Response(null,{status:204}));
    expect(await deleteStoredGeneration(env,"",obj.name,"123456",transport)).toBe("deleted");
    expect(transport.mock.calls[0][0]).toContain("ifGenerationMatch=123456");
    expect(transport.mock.calls[0][1]?.method).toBe("DELETE");
    await expect(deleteStoredGeneration(env,"",obj.name,"bad",transport)).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
    await expect(getStoredObject({...env,FIREBASE_STORAGE_EMULATOR_HOST:"example.com:9199"},"",obj.name,transport)).rejects.toThrow();
  });
  it("returns missing and generation mismatch distinctly",async()=>{
    const missing=vi.fn(async (_input:RequestInfo|URL,_init?:RequestInit)=>new Response(null,{status:404}));
    const conflict=vi.fn(async (_input:RequestInfo|URL,_init?:RequestInit)=>new Response(null,{status:412}));
    expect(await getStoredObject(env,"",obj.name,missing)).toBeNull();
    expect(await deleteStoredGeneration(env,"",obj.name,"123456",missing)).toBe("missing");
    expect(await deleteStoredGeneration(env,"",obj.name,"123456",conflict)).toBe("conflict");
  });
  it("inventory is bounded per page, reports token, does not pretend to measure egress",async()=>{
    const transport=vi.fn(async (_input:RequestInfo|URL,_init?:RequestInit)=>new Response(JSON.stringify({items:[obj],nextPageToken:"next"}),{status:200}));
    const page=await listStoredObjects(env,"","tenants/a/public/portfolio/",undefined,transport);
    expect(page.objects).toHaveLength(1);
    expect(page.nextPageToken).toBe("next");
    expect(transport.mock.calls[0][0]).toContain("maxResults=100");
  });
  it("classifies persistent and legacy bytes without implying egress or price",()=>{
    const bytes=summarizeStoragePage([
      {name:"new",generation:"1",size:4096,contentType:"image/webp",
        metadata:{mediaClass:"PERSISTENT_BUSINESS",metadataPolicy:"reencoded_no_exif"}},
      {name:"old",generation:"2",size:1024,contentType:"image/jpeg",
        metadata:{mediaClass:"UNKNOWN_LEGACY"}},
      {name:"unclassified",generation:"3",size:512,contentType:"application/octet-stream",
        metadata:{mediaClass:"ANALYTICS_TEMP",metadataPolicy:"safe"}},
    ]);
    expect(bytes).toEqual({objectCount:3,totalBytes:5632,
      persistentCount:1,persistentBytes:4096,
      legacyCount:1,legacyBytes:1024,otherCount:1,otherBytes:512});
    expect(()=>summarizeStoragePage([{name:"bad",generation:"1",size:-1,contentType:"",metadata:{}}])).toThrow();
  });
  it("rejects corrupt Storage generation or missing object size",async()=>{
    const transport=vi.fn(async (_input:RequestInfo|URL,_init?:RequestInit)=>new Response(JSON.stringify({
      name:obj.name,generation:"not-valid",size:"bad",
    }),{status:200}));
    await expect(getStoredObject(env,"",obj.name,transport)).rejects.toThrow();
  });
});
