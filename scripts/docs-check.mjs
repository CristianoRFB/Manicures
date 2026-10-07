import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docs = path.join(root, 'docs');
const fail = (m) => { console.error(`DOCS_CHECK_FAIL: ${m}`); process.exitCode = 1; };
const ok = (m) => console.log(`DOCS_CHECK_OK: ${m}`);
const exists = (p) => fs.existsSync(path.join(root, p));

for (const p of ['docs/CURRENT.md','docs/DIAGRAMS_MANIFEST.md','docs/LEADS_MANIFEST.md']) {
  exists(p) ? ok(p) : fail(`missing ${p}`);
}

const currentPath = path.join(docs, 'CURRENT.md');
let version = null;
if (fs.existsSync(currentPath)) {
  const current = fs.readFileSync(currentPath, 'utf8');
  const m = current.match(/`(v[^`]+)`/);
  if (!m) fail('CURRENT.md does not declare version in backticks');
  else version = m[1];
}

if (version) {
  const base = `docs/versions/${version}`;
  const required = ['README.md','STATUS.md','ARCHITECTURE.md','DATA_MODEL.md','SECURITY.md','FIREBASE_STRUCTURE.md','PROJECT_STRUCTURE.md','SCREENS.md','GENERATED_VISUALS.md','LEADS_OVERVIEW.md'];
  for (const f of required) exists(`${base}/${f}`) ? ok(`${base}/${f}`) : fail(`missing ${base}/${f}`);
  for (const dir of ['diagrams/source','diagrams/rendered','screenshots','generated/concepts','generated/mockups','generated/lead-adapted','generated/covers','leads']) {
    exists(`${base}/${dir}`) ? ok(`${base}/${dir}`) : fail(`missing ${base}/${dir}`);
  }
}

function validateManifest(file, patterns) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const rx of patterns) {
    for (const m of text.matchAll(rx)) {
      const ref = m[1].replace(/^\.\//,'');
      const rel = ref.startsWith('docs/') ? ref : path.posix.join('docs', ref);
      exists(rel) ? ok(`${file} -> ${rel}`) : fail(`${file} references missing ${rel}`);
    }
  }
}
validateManifest('docs/DIAGRAMS_MANIFEST.md', [/`(versions\/[^`]+\.(?:mmd|svg))`/g]);

// Validate explicit local screenshot/generated paths if they are added later.
if (version) {
  const screens = path.join(root, `docs/versions/${version}/SCREENS.md`);
  const generated = path.join(root, `docs/versions/${version}/GENERATED_VISUALS.md`);
  for (const p of [screens, generated]) {
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    for (const m of text.matchAll(/`((?:screenshots|generated)\/[^`]+\.(?:png|jpg|jpeg|webp|svg))`/gi)) {
      const rel = `docs/versions/${version}/${m[1]}`;
      exists(rel) ? ok(rel) : fail(`referenced asset missing ${rel}`);
    }
  }
}

if (!process.exitCode) console.log('DOCS_CHECK_PASS');
