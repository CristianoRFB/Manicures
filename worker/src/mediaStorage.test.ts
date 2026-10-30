import {describe,expect,it,vi} from "vitest";
import {deleteStoredGeneration,getStoredObject,listStoredObjects,summarizeStoragePage,scanStoragePrefix} from "./mediaStorage";
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
  it("scans bounded pages with cursor and preserves per-class byte totals",async()=>{
    const path="tenants/a/public/portfolio/";
    const calls:string[]=[];
    const first={name:path+"a.webp",generation:"1",size:"2048",
      metadata:{mediaClass:"PERSISTENT_BUSINESS",metadataPolicy:"reencoded_no_exif"},contentType:"image/webp"};
    const second={name:path+"legacy.jpg",generation:"2",size:"1024",metadata:{},contentType:"image/jpeg"};
    const transport=(async(input:RequestInfo|URL)=>{
      const url=new URL(String(input));calls.push(url.toString());
      return new Response(JSON.stringify(url.searchParams.has("pageToken")?
        {items:[second]}:{items:[first],nextPageToken:"more"}),{status:200});
    }) as typeof fetch;
    const one=await scanStoragePrefix(env,"",path,undefined,1,transport);
    expect(one.pagesScanned).toBe(1);
    expect(one.complete).toBe(false);
    expect(one.metrics.totalBytes).toBe(2048);
    const resumed=await scanStoragePrefix(env,"",path,one.nextPageToken!,2,transport);
    expect(resumed.complete).toBe(true);
    expect(resumed.metrics.legacyBytes).toBe(1024);
    expect(calls).toHaveLength(2);
  });
  it("rejects prefix crossing, cursor loops, oversized and invalid page budgets",async()=>{
    const path="tenants/a/public/portfolio/";
    const outsider=(async()=>new Response(JSON.stringify({items:[
      {name:"tenants/b/public/portfolio/secret.webp",generation:"1",size:"10"},
    ]}),{status:200})) as typeof fetch;
    await expect(scanStoragePrefix(env,"","tenants/a/appointments/",undefined,1,outsider)).rejects.toThrow();
    await expect(scanStoragePrefix(env,"",path,undefined,1,outsider)).rejects.toThrow("fora do tenant");
    await expect(scanStoragePrefix(env,"",path,undefined,21,outsider)).rejects.toThrow();
    const loop=(async()=>new Response(JSON.stringify({items:[],nextPageToken:"repeat"}),{status:200})) as typeof fetch;
    await expect(scanStoragePrefix(env,"",path,undefined,3,loop)).rejects.toThrow("cíclico");
  });
  it("rejects corrupt Storage generation or missing object size",async()=>{
    const transport=vi.fn(async (_input:RequestInfo|URL,_init?:RequestInit)=>new Response(JSON.stringify({
      name:obj.name,generation:"not-valid",size:"bad",
    }),{status:200}));
    await expect(getStoredObject(env,"",obj.name,transport)).rejects.toThrow();
  });
});
