import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const current=fs.readFileSync(path.join(root,'docs/CURRENT.md'),'utf8');
const m=current.match(/`(v[^`]+)`/);
if(!m) throw new Error('CURRENT version not found');
const version=m[1];
const src=path.join(root,'docs','versions',version,'diagrams','source');
const out=path.join(root,'docs','versions',version,'diagrams','rendered');
fs.mkdirSync(out,{recursive:true});
const files=fs.readdirSync(src).filter(f=>f.endsWith('.mmd'));
if(files.length===0){ console.log('DOCS_DIAGRAMS_PASS: no Mermaid sources'); process.exit(0); }
const probe=spawnSync('mmdc',['--version'],{encoding:'utf8'});
if(probe.status!==0){
  console.error('mmdc not available. Install @mermaid-js/mermaid-cli in the Codex environment before rendering.');
  process.exit(2);
}
for(const f of files){
  const target=path.join(out,f.replace(/\.mmd$/,'.svg'));
  const r=spawnSync('mmdc',['-i',path.join(src,f),'-o',target,'-b','transparent'],{stdio:'inherit'});
  if(r.status!==0) process.exit(r.status ?? 1);
}
console.log(`DOCS_DIAGRAMS_PASS: rendered ${files.length} diagram(s)`);
