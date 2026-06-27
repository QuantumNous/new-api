#!/usr/bin/env node
// import-design-system.mjs — the consumer-side SYNC step of the portable
// design-system pipeline. Given a compiled design-system folder (<dsDir>, which
// holds _ds_manifest.json at its root) and a regular design project
// (<projectDir>), it copies the design system's runtime subset into
// <projectDir>/_ds/<dsSlug>/ as a self-contained, version-pinned copy, then
// records the binding in <projectDir>/_d_meta.json.
//
// Usage: node import-design-system.mjs <dsDir> <projectDir> [--primary]
//
// It reuses the read-only parser (ds-core.mjs) to resolve the exact copy set
// (the global-CSS @import closure + every local url() asset those files
// reference). It writes ONLY under <projectDir>/_ds/<dsSlug>/ and
// <projectDir>/_d_meta.json — it never touches the DS source and never transpiles
// (compile-design-system.mjs owns transpilation).

import fs from 'node:fs';
import path from 'node:path';
import { buildModel } from './lib/ds-core.mjs';
import { metaPathFor, readMeta, bootstrapMeta, writeMeta } from './lib/asset-store.mjs';
import { renderDsPrompt, extractPromptExcerpt, sampleComponentNames } from './lib/ds-prompt.mjs';

// --- args ---------------------------------------------------------------------
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const [dsDirArg, projectDirArg] = positional;

if (!dsDirArg || !projectDirArg) {
  process.stderr.write('Usage: node import-design-system.mjs <dsDir> <projectDir> [--primary]\n');
  process.exit(64);
}
const makePrimary = flags.has('--primary');

const dsDir = path.resolve(dsDirArg);
const projectDir = path.resolve(projectDirArg);

if (!fs.existsSync(dsDir) || !fs.statSync(dsDir).isDirectory()) {
  process.stderr.write(`import-design-system: not a directory: ${dsDirArg}\n`);
  process.exit(1);
}
if (!fs.existsSync(path.join(dsDir, '_ds_manifest.json'))) {
  process.stderr.write(
    `import-design-system: ${dsDirArg} is not a compiled design system ` +
    '(no _ds_manifest.json at its root). Run compile-design-system.mjs there first.\n',
  );
  process.exit(1);
}

// --- model + paths ------------------------------------------------------------
let model;
try {
  model = buildModel(dsDir);
} catch (e) {
  process.stderr.write(`import-design-system: ${(e && e.message) || e}\n`);
  process.exit(1);
}

const dsSlug = path.basename(dsDir);
const destRoot = path.join(projectDir, '_ds', dsSlug);

// --- copy helpers -------------------------------------------------------------
const toPosix = (p) => p.split(path.sep).join('/');

function copyFileRel(relPath) {
  const from = path.join(dsDir, relPath);
  const to = path.join(destRoot, relPath);
  if (!fs.existsSync(from) || !fs.statSync(from).isFile()) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

const copied = new Set();
function copyOnce(relPath) {
  if (copied.has(relPath)) return;
  if (copyFileRel(relPath)) copied.add(relPath);
}

// local url() targets referenced by a CSS file (fonts + images), resolved
// relative to that CSS file's own directory and returned relative to dsDir.
const URL_RE = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
function cssAssetTargets(cssRel) {
  let css;
  try { css = fs.readFileSync(path.join(dsDir, cssRel), 'utf8'); } catch { return []; }
  const dir = path.posix.dirname(cssRel);
  const out = [];
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(css))) {
    let u = m[1].trim();
    if (!u || /^(https?:|data:|#)/i.test(u)) continue;
    u = u.replace(/[?#].*$/, ''); // strip ?v=… / #iefix
    if (!u) continue;
    const relToDs = path.posix.normalize(path.posix.join(dir, u));
    if (relToDs.startsWith('..')) continue; // outside the DS folder — skip
    out.push(relToDs);
  }
  return out;
}

function copyDirRel(relDir) {
  const fromDir = path.join(dsDir, relDir);
  if (!fs.existsSync(fromDir) || !fs.statSync(fromDir).isDirectory()) return 0;
  let n = 0;
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) rec(abs);
      else if (e.isFile()) { copyOnce(toPosix(path.relative(dsDir, abs))); n++; }
    }
  };
  rec(fromDir);
  return n;
}

// --- copy set -----------------------------------------------------------------
// 1. global CSS @import closure (post-order: imports before importer)
for (const css of model.globalCssPaths) copyOnce(css);
const cssCount = copied.size;
// 2. url() assets (font binaries + images) referenced by those CSS files
for (const css of model.globalCssPaths) {
  for (const asset of cssAssetTargets(css)) copyOnce(asset);
}
const assetUrlCount = copied.size - cssCount;
// 3. bundle + manifest + adherence + readme + skill
const hasBundle = copyFileRel('_ds_bundle.js');
if (hasBundle) copied.add('_ds_bundle.js');
for (const f of ['_ds_manifest.json', '_adherence.oxlintrc.json', 'README.md', 'SKILL.md']) copyOnce(f);
// 4. shared runtime assets directory, if present
const beforeAssets = copied.size;
copyDirRel('assets');
const assetDirCount = copied.size - beforeAssets;

// --- design-system display name -----------------------------------------------
function firstH1(mdRel) {
  try {
    const m = /^#\s+(.+?)\s*$/m.exec(fs.readFileSync(path.join(dsDir, mdRel), 'utf8'));
    if (m) return m[1].trim();
  } catch { /* none */ }
  return null;
}
function skillName(skillRel) {
  try {
    const m = /^name:\s*(.+?)\s*$/m.exec(fs.readFileSync(path.join(dsDir, skillRel), 'utf8'));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch { /* none */ }
  return null;
}
const titleCase = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const dsName = firstH1('README.md') || skillName('SKILL.md') || titleCase(dsSlug);

// --- merge _d_meta.json --------------------------------------------------
const metaPath = metaPathFor(projectDir);
let meta;
try {
  meta = readMeta(metaPath);
} catch (e) {
  process.stderr.write(`import-design-system: ${(e && e.message) || e}\n`);
  process.exit(1);
}
bootstrapMeta(meta);

const entry = {
  name: dsName,
  slug: dsSlug,
  namespace: model.namespace,
  dsFolder: `_ds/${dsSlug}`,
  sourcePath: toPosix(path.relative(process.cwd(), dsDir)),
};
const idx = meta.designSystems.findIndex((d) => d && d.slug === dsSlug);
if (idx >= 0) meta.designSystems[idx] = { ...meta.designSystems[idx], ...entry };
else meta.designSystems.push(entry);

// primary pointer: first import auto-claims it; --primary overrides
if (makePrimary || !meta.primaryDesignSystem) meta.primaryDesignSystem = dsSlug;

writeMeta(metaPath, meta);

// --- generate the per-load design-system prompt -------------------------------
// Per-component usage excerpts come from the DS *source* — the *.prompt.md files
// are deliberately not copied into _ds/, so their first lines ride in the prompt.
const promptPathFor = (sp) => sp.replace(/\.(jsx|tsx)$/, '.prompt.md');
const seenPrompts = new Set();
const componentPrompts = [];
for (const c of model.components) {
  const relPrompt = promptPathFor(c.sourcePath);
  if (seenPrompts.has(relPrompt)) continue; // several exports can share one source file
  seenPrompts.add(relPrompt);
  let text;
  try { text = fs.readFileSync(path.join(dsDir, relPrompt), 'utf8'); } catch { continue; }
  const excerpt = extractPromptExcerpt(text);
  if (excerpt) componentPrompts.push({ relPath: relPrompt, excerpt });
}
let readmeContent = '';
try { readmeContent = fs.readFileSync(path.join(dsDir, 'README.md'), 'utf8'); } catch { /* none */ }
const promptMd = renderDsPrompt({
  name: dsName,
  slug: dsSlug,
  namespace: model.namespace,
  globalCssPaths: model.globalCssPaths,
  componentNames: model.components.map((c) => c.name),
  componentPrompts,
  componentProps: model.components,
  readme: readmeContent,
  tokenNames: model.tokens.map((t) => t.name),
  sourcePath: entry.sourcePath,
  hasBundle,
});
fs.writeFileSync(path.join(destRoot, '_ds_prompt.md'), promptMd);
copied.add('_ds_prompt.md');

// --- report -------------------------------------------------------------------
const out = [];
out.push(`Imported "${dsName}" → ${toPosix(path.relative(process.cwd(), destRoot))}/  (namespace ${model.namespace})`);
out.push(
  `Synced ${copied.size} files: ${cssCount} CSS (@import closure), ` +
  `${assetUrlCount} url() asset(s), ${assetDirCount} assets/ file(s), ` +
  `plus bundle/manifest/adherence/readme/skill and a generated _ds_prompt.md.`,
);
out.push(`_d_meta.json: designSystems["${dsSlug}"] recorded; primaryDesignSystem = "${meta.primaryDesignSystem}".`);
out.push('');
if (hasBundle) {
  out.push(
    'Wire it up in your page — window.React/window.ReactDOM first (the bundle calls ' +
    'React.createElement), then every stylesheet below in order, then the bundle as a plain ' +
    '<script> (no type="text/babel" / type="module"). With several systems, the PRIMARY ' +
    "system's <link>s load LAST so its tokens win:",
  );
} else {
  out.push(
    'Wire it up in your page — every stylesheet below in order. With several systems, the ' +
    "PRIMARY system's <link>s load LAST so its tokens win:",
  );
}
if (model.globalCssPaths.length) {
  for (const p of model.globalCssPaths) out.push(`  <link rel="stylesheet" href="_ds/${dsSlug}/${p}">`);
} else {
  out.push(`  (no global CSS entry found in this DS${hasBundle ? ' — only the bundle was copied' : ''})`);
}
if (hasBundle) out.push(`  <script src="_ds/${dsSlug}/_ds_bundle.js"></script>`);
if (hasBundle && model.components.length) {
  const sample = sampleComponentNames(model.components.map((c) => c.name)).join(', ');
  out.push(`  then: const { ${sample} } = window.${model.namespace};`);
}

out.push('');
out.push('Next: load this system as a BINDING visual style —');
out.push(`  read _ds/${dsSlug}/_ds_prompt.md before designing`);
out.push('  (binding + scope + bundle wiring + the full guide + per-component usage notes + the exact var(--*) token allowlist).');

if (model.startingPoints.length) {
  out.push('');
  out.push('Starting points (opt-in seeds you can pass as the project starting point):');
  for (const sp of model.startingPoints) {
    out.push(`  - ${sp.name} [${sp.kind}]${sp.section ? ` — ${sp.section}` : ''}  (${sp.path})`);
  }
} else if (model.cards.length) {
  out.push('');
  out.push(`No @startingPoint seeds; ${model.cards.length} card(s) available as reference.`);
}

const warnings = [];
if (!hasBundle) {
  warnings.push('_ds_bundle.js is missing — this DS has not been compiled. Run compile-design-system.mjs in the DS folder, then re-import.');
}
for (const issue of model.issues) warnings.push(issue);
if (warnings.length) {
  out.push('');
  out.push('Warnings:');
  for (const w of warnings) out.push(`  ! ${w}`);
}

process.stdout.write(out.join('\n') + '\n');
