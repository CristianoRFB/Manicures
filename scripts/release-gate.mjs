import {readFileSync,existsSync} from "node:fs";

function load(path){if(!existsSync(path))throw new Error("Arquivo obrigatório ausente: "+path);return readFileSync(path,"utf8");}
function assert(ok,why){if(!ok)throw new Error("RELEASE_GATE_FAILED: "+why);}
const wrangler=load("worker/wrangler.toml");
const local=load("worker/.dev.vars.example");
const storage=load("storage.rules");
const firestore=load("firestore.rules");
const api=load("worker/src/index.ts");
const ci=load(".github/workflows/ci.yml");
const pkg=JSON.parse(load("package.json"));
const stagingWorkflow=load(".github/workflows/staging-smoke.yml");
assert(!/^\s*MEDIA_DELETION_ENABLED\s*=\s*["']?true\b/im.test(wrangler),"Não habilitar exclusão em configuração versionada");
assert(/^MEDIA_DELETION_ENABLED=false$/m.test(local),"Emulator local deve manter exclusão desabilitada");
assert(api.includes('env.MEDIA_DELETION_ENABLED!=="true"'),"Worker deve exigir opt-in explícito de exclusão");
assert(api.includes("validateRequestOrigin(request,env)")&&api.includes("PRIVATE_HTTP_HEADERS"),"Worker deve aplicar origem autorizada e no-store em respostas sensíveis");
assert(!/^ALLOWED_ORIGIN\s*=\s*["']?\*["']?\s*$/m.test(wrangler),"CORS wildcard proibido em configuração versionada");

assert(storage.includes("allow update, delete: if false;"),"Storage deve negar mutação destrutiva por SDK");
assert(storage.includes("resource == null"),"Storage deve proteger contra overwrite");
assert(firestore.includes("match /guestClaims/{claimId}"),"Conciliação guest deve ser Worker-only");
assert(firestore.includes("match /mediaRemovalRequests/{requestId}"),"Pedido de mídia deve ser Worker-only");
assert(ci.includes("npm run test:emulator")&&ci.includes("npm run qa:browser:auth"),"CI deve exercitar regras e navegador autenticado");
assert(ci.includes("npm run qa:browser:fail-closed"),"CI precisa testar que builds reais não voltam ao modo DEMO");
assert(pkg.scripts["qa:staging:smoke:test"]&&stagingWorkflow.includes("workflow_dispatch"),"Staging smoke deve existir apenas com ativação manual");
assert(stagingWorkflow.includes("sample_tenant_id")&&stagingWorkflow.includes("sample_date"),"Staging deve permitir prova opcional dos índices com fixture sintética");
assert(pkg.scripts.test.includes("src/commercial"),"CI deve executar regras comerciais unitárias");
assert(pkg.scripts.test.includes("src/data"),"CI deve executar testes do repositório e da API de booking");
assert(api.includes("queryScopedDocuments"),"Worker deve manter consultas direcionadas por tenant");
for(const path of ["docs/STORAGE_DELETION_RUNBOOK.md","docs/GUEST_HISTORY_LINKING.md","docs/BROWSER_QA_EVIDENCE.md"])load(path);
const indexDefinitions=JSON.parse(load("firestore.indexes.json")).indexes ?? [];
function requiresIndex(collection,fieldNames){
  assert(indexDefinitions.some(row=>row.collectionGroup===collection && row.queryScope==="COLLECTION" &&
    JSON.stringify(row.fields?.map(f=>f.fieldPath))===JSON.stringify(fieldNames)),
    "Índice Firestore necessário ausente: "+collection+" "+fieldNames.join(","));
}
requiresIndex("bookingLocks",["professionalId","dateKey"]);
requiresIndex("scheduleBlocks",["professionalId","startsAt","endsAt"]);
requiresIndex("appointments",["professionalId","startsAt"]);
requiresIndex("appointments",["professionalId","startsAt","endsAt"]);

process.stdout.write(JSON.stringify({
  codeIntegration:"PASS",
  destructiveMediaDefault:"DISABLED",
  requiredTestSuites:"PRESENT",
  productionRelease:"BLOCKED_PENDING_EXTERNAL_STAGING_IAM_EGRESS_AND_HUMAN_QA",
},null,2)+"\n");
