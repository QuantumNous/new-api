// i18n:check — locale parity for extracted keys.
//
// Guarantee: every user-facing key discovered under src/ exists in each locale JSON,
// and each locale has no stale keys. Keys are English source strings
// (see src/i18n/index.ts). English needs no resource file (key === fallback).
//
// Extracted from:
//   - t("…") / t('…')  (double- or single-quoted call sites)
//   - i18n.t("…") / i18n.t('…')
//   - labelKey: "…" / descriptionKey: "…"  (dynamic t(var) tables)
//
// Still out of scope: fully dynamic keys built at runtime without a static string,
// hardcoded JSX without t(), identity translations (value === key), hybrid garbage.
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

function unescape(s) {
  return s.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, "\n");
}

const used = new Set();
for (const file of walk(srcDir)) {
  // skip test files — they may assert English without needing locale entries
  if (/\.test\.(tsx?|mts)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  // t("…") and i18n.t("…") — double quotes
  for (const m of text.matchAll(/(?:\bi18n\.)?\bt\(\s*"((?:[^"\\]|\\.)+)"/g)) {
    used.add(unescape(m[1]));
  }
  // t('…') and i18n.t('…') — single quotes
  for (const m of text.matchAll(/(?:\bi18n\.)?\bt\(\s*'((?:[^'\\]|\\.)+)'/g)) {
    used.add(unescape(m[1]));
  }
  // labelKey / descriptionKey tables feeding t(dynamicKey)
  for (const m of text.matchAll(/\b(?:labelKey|descriptionKey)\s*:\s*"((?:[^"\\]|\\.)+)"/g)) {
    used.add(unescape(m[1]));
  }
  for (const m of text.matchAll(/\b(?:labelKey|descriptionKey)\s*:\s*'((?:[^'\\]|\\.)+)'/g)) {
    used.add(unescape(m[1]));
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
console.log(
  `i18n:check OK — ${used.size} keys, ${readdirSync(localesDir).filter((f) => f.endsWith(".json")).length} locale file(s).`,
);
