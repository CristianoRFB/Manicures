import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const current=fs.readFileSync(path.join(root,'docs/CURRENT.md'),'utf8');
const m=current.match(/`(v[^`]+)`/);
if(!m) throw new Error('CURRENT version not found');
const version=m[1];
const leadsRoot=path.join(root,'docs','versions',version,'leads');
const manifest=fs.readFileSync(path.join(root,'docs','LEADS_MANIFEST.md'),'utf8');
const dirs=fs.readdirSync(leadsRoot,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name);
if(dirs.length===0){
  if(!/Leads reais confirmados:\s*\*\*0\*\*/.test(manifest)) throw new Error('No lead dirs but manifest does not declare zero confirmed leads');
  console.log('DOCS_LEADS_PASS: no confirmed leads');
  process.exit(0);
}
for(const slug of dirs){
  const base=path.join(leadsRoot,slug);
  for(const f of ['LEAD_CONTEXT.md','LEAD_REFERENCE_SUMMARY.md','LEAD_VISUAL_DIRECTION.md']){
    if(!fs.existsSync(path.join(base,f))) throw new Error(`Lead ${slug} missing ${f}`);
  }
}
console.log(`DOCS_LEADS_PASS: ${dirs.length} lead(s)`);
