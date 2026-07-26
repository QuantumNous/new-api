// i18n:check — every t("…") key used in src/ must exist in each locale file, and each
// locale must not carry stale keys. Keys are English source strings (see src/i18n/index.ts).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");
const localesDir = join(srcDir, "i18n", "locales");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(tsx?|mts)$/.test(name) ? [p] : [];
  });
}

const used = new Set();
for (const file of walk(srcDir)) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)+)"/g)) {
    used.add(m[1].replace(/\\"/g, '"'));
  }
}

let failed = false;
for (const file of readdirSync(localesDir).filter((f) => f.endsWith(".json"))) {
  const keys = new Set(Object.keys(JSON.parse(readFileSync(join(localesDir, file), "utf8"))));
  const missing = [...used].filter((k) => !keys.has(k)).sort();
  const stale = [...keys].filter((k) => !used.has(k)).sort();
  if (missing.length) {
    failed = true;
    console.error(`${file}: missing ${missing.length} key(s):`);
    for (const k of missing) console.error(`  + ${JSON.stringify(k)}`);
  }
  if (stale.length) {
    failed = true;
    console.error(`${file}: stale ${stale.length} key(s):`);
    for (const k of stale) console.error(`  - ${JSON.stringify(k)}`);
  }
}

if (failed) process.exit(1);
console.log(`i18n:check OK — ${used.size} keys, ${readdirSync(localesDir).filter((f) => f.endsWith(".json")).length} locale file(s).`);
