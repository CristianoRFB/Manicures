import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireHttpsOrigin,runStagingSmoke } from "./staging-smoke.mjs";

const WEB="https://studio-staging.example.com";
const API="https://api-staging.example.com";
const HEADERS={"cache-control":"private, no-store, max-age=0",
  "x-content-type-options":"nosniff","vary":"Origin"};
function fakeFetch({wrongOrigin=false,allowForeign=false,cacheOff=false}={}) {
  const calls=[];
  const fetcher=async (raw,options)=>{
    const url=String(raw);calls.push({url,method:options.method??"GET"});
    if(url===WEB+"/")return new Response("<!doctype html><title>Manicure staging</title>",
      {status:200,headers:{"content-type":"text/html; charset=utf-8"}});
    const h={...HEADERS,...(cacheOff?{"cache-control":"public, max-age=60"}:{})};
    const origin=options.headers?.origin;
    if(url===API+"/health")return new Response(JSON.stringify({ok:true,service:"saas-manicure-booking-api"}),
      {status:200,headers:{...h,"content-type":"application/json",
        "access-control-allow-origin":wrongOrigin?"*":WEB}});
    if(url===API+"/api/bookings"&&options.method==="OPTIONS"){
      if(origin!=="https://rejected-origin.invalid")
        return new Response(null,{status:204,headers:{...h,"access-control-allow-origin":WEB}});
      return new Response(null,{status:allowForeign?204:403,
        headers:allowForeign?{...h,"access-control-allow-origin":"*"}:h});
    }
    if(url.startsWith(API+"/api/availability?"))
      return new Response(JSON.stringify({error:"Parâmetros inválidos."}),{status:400,headers:{
        ...h,"access-control-allow-origin":WEB,
      }});
    throw new Error("Unexpected request: "+url);
  };
  return {fetcher,calls};
}
describe("staging smoke read-only contract",()=>{
  it("accepts exact public HTTPS origins only",()=>{
    assert.equal(requireHttpsOrigin(WEB,"web"),WEB);
    for(const invalid of ["","http://studio.example.com","https://localhost:5173",
      "https://127.0.0.1","https://example.com/private","https://example.com?x=1",
      "https://user:pass@example.com","https://example.com/"]){
      assert.throws(()=>requireHttpsOrigin(invalid,"web"));
    }
  });
  it("checks five read-only paths without auth or mutation",async()=>{
    const fake=fakeFetch();
    const out=await runStagingSmoke({webOrigin:WEB,apiOrigin:API,fetcher:fake.fetcher});
    assert.equal(out.status,"PASS");
    assert.equal(out.checks.length,5);
    assert.equal(fake.calls.length,5);
    assert.ok(fake.calls.every(call=>["GET","OPTIONS"].includes(call.method)));
  });
  it("fails when CORS is wildcard, caches private payloads or allows attacker origin",async()=>{
    for(const variant of [{wrongOrigin:true},{cacheOff:true},{allowForeign:true}]){
      await assert.rejects(runStagingSmoke({webOrigin:WEB,apiOrigin:API,
        fetcher:fakeFetch(variant).fetcher}),/STAGING_SMOKE_FAILED/);
    }
  });
  it("does not make a network call for invalid staging origins",async()=>{
    let invoked=false;
    await assert.rejects(runStagingSmoke({webOrigin:"http://localhost:5173",apiOrigin:API,
      fetcher:async()=>{invoked=true;return new Response();}}));
    assert.equal(invoked,false);
  });
});
