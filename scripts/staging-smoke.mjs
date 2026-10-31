import { pathToFileURL } from "node:url";

/** Validate exact public HTTPS origin; never perform smoke checks against localhost. */
export function requireHttpsOrigin(value, label) {
  if (!value || typeof value !== "string") throw new Error(label + " é obrigatório.");
  let url;
  try { url = new URL(value); } catch { throw new Error(label + " deve ser uma origem HTTPS válida."); }
  if (url.protocol !== "https:" || value !== url.origin || url.username || url.password ||
      url.hostname === "localhost" || !url.hostname.includes(".") ||
      /^[0-9]{1,3}(?:[.][0-9]{1,3}){3}$/.test(url.hostname) ||
      url.hostname.endsWith(".local"))
    throw new Error(label + " deve ser origem HTTPS pública exata, sem path, query ou credenciais.");
  return url.origin;
}
function must(condition, message) { if (!condition) throw new Error("STAGING_SMOKE_FAILED: " + message); }

/** Read-only smoke: no password, no personal data, no writes or destructive operations. */
export async function runStagingSmoke({ webOrigin, apiOrigin, fetcher = fetch }) {
  const web = requireHttpsOrigin(webOrigin, "STAGING_WEB_ORIGIN");
  const api = requireHttpsOrigin(apiOrigin, "STAGING_API_ORIGIN");
  const checks = [];
  const call = (url,init={})=>fetcher(url,{
    ...init, redirect:"error", cache:"no-store", signal:AbortSignal.timeout(15000),
  });
  const checkPrivacy = (response,kind)=>{
    must((response.headers.get("cache-control")??"").includes("no-store"),
      kind + " sem no-store");
    must(response.headers.get("x-content-type-options")==="nosniff",kind+" sem nosniff");
    must((response.headers.get("vary")??"").toLowerCase().includes("origin"),kind+" sem Vary: Origin");
  };
  const page = await call(web+"/");
  must(page.status===200,"página pública indisponível ("+page.status+")");
  must((page.headers.get("content-type")??"").includes("text/html"),"frontend não serviu HTML");
  checks.push("frontend_https_html");

  const health = await call(api+"/health",{headers:{origin:web}});
  must(health.status===200,"health indisponível ("+health.status+")");
  const data=await health.json();
  must(data?.ok===true && data.service==="saas-manicure-booking-api","health do serviço errado");
  must(health.headers.get("access-control-allow-origin")===web,"CORS não autoriza a origem real");
  checkPrivacy(health,"health");
  checks.push("api_health_cors_no_store");

  const preflight = await call(api+"/api/bookings",{
    method:"OPTIONS",headers:{origin:web,"access-control-request-method":"POST",
      "access-control-request-headers":"content-type,authorization"},
  });
  must(preflight.status===204,"preflight válida negada ("+preflight.status+")");
  must(preflight.headers.get("access-control-allow-origin")===web,"preflight com CORS incorreto");
  checkPrivacy(preflight,"preflight");
  checks.push("approved_preflight");

  const forbidden=await call(api+"/api/bookings",{
    method:"OPTIONS",headers:{origin:"https://rejected-origin.invalid",
      "access-control-request-method":"POST"},
  });
  must(forbidden.status===403,"origem estranha não foi negada ("+forbidden.status+")");
  must(!forbidden.headers.get("access-control-allow-origin"),
    "origem estranha recebeu autorização CORS");
  checks.push("foreign_origin_blocked");

  const invalid=await call(api+"/api/availability?tenantId=%21&serviceId=%21&professionalId=%21&date=2000-01-01",{
    headers:{origin:web},
  });
  must(invalid.status===400,"validação pública não retornou 400 ("+invalid.status+")");
  must(invalid.headers.get("access-control-allow-origin")===web,"CORS de erro incorreto");
  checkPrivacy(invalid,"erro de validação");
  checks.push("read_only_invalid_request_guard");

  return {status:"PASS",checks,mode:"read_only_no_credentials",webOrigin:web,apiOrigin:api};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runStagingSmoke({webOrigin:process.env.STAGING_WEB_ORIGIN,apiOrigin:process.env.STAGING_API_ORIGIN})
    .then(result=>{console.log(JSON.stringify(result,null,2));})
    .catch(error=>{console.error(error instanceof Error?error.message:"STAGING_SMOKE_FAILED");process.exitCode=1;});
}
