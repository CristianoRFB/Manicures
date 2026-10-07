import fs from "node:fs";
import path from "node:path";

const roots = ["src", "docs", ".env.example", "README.md", "AGENTS.md"];
const suspicious = [/-----BEGIN PRIVATE KEY-----/, /service_account/i, /AIza[0-9A-Za-z_-]{20,}/];
let failed = false;

function scan(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) return fs.readdirSync(target).forEach((item) => scan(path.join(target, item)));
  const text = fs.readFileSync(target, "utf8");
  for (const pattern of suspicious) {
    if (pattern.test(text)) {
      console.error(`Possível credencial em ${target}: ${pattern}`);
      failed = true;
    }
  }
}
roots.forEach(scan);
if (failed) process.exit(1);
console.log("No obvious credentials found.");
