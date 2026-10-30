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
assert(!/^\s*MEDIA_DELETION_ENABLED\s*=\s*["']?true\b/im.test(wrangler),"Não habilitar exclusão em configuração versionada");
assert(/^MEDIA_DELETION_ENABLED=false$/m.test(local),"Emulator local deve manter exclusão desabilitada");
assert(api.includes('env.MEDIA_DELETION_ENABLED!=="true"'),"Worker deve exigir opt-in explícito de exclusão");
assert(storage.includes("allow update, delete: if false;"),"Storage deve negar mutação destrutiva por SDK");
assert(storage.includes("resource == null"),"Storage deve proteger contra overwrite");
assert(firestore.includes("match /guestClaims/{claimId}"),"Conciliação guest deve ser Worker-only");
assert(firestore.includes("match /mediaRemovalRequests/{requestId}"),"Pedido de mídia deve ser Worker-only");
assert(ci.includes("npm run test:emulator")&&ci.includes("npm run qa:browser:auth"),"CI deve exercitar regras e navegador autenticado");
assert(pkg.scripts.test.includes("src/commercial"),"CI deve executar regras comerciais unitárias");
for(const path of ["docs/STORAGE_DELETION_RUNBOOK.md","docs/GUEST_HISTORY_LINKING.md","docs/BROWSER_QA_EVIDENCE.md"])load(path);
process.stdout.write(JSON.stringify({
  codeIntegration:"PASS",
  destructiveMediaDefault:"DISABLED",
  requiredTestSuites:"PRESENT",
  productionRelease:"BLOCKED_PENDING_EXTERNAL_STAGING_IAM_EGRESS_AND_HUMAN_QA",
},null,2)+"\n");
