// ds-core.mjs — shared, write-nothing parser for the portable baoyu-design
// design-system compiler + checker. Node stdlib only (node:fs, node:path,
// node:crypto). It builds a full project model from a design-system folder:
// global CSS / token closure, classified tokens, component modules + exports,
// @dsCard cards, @startingPoint starting points, brand fonts, namespace, and a
// list of issues. NOTHING in this module writes to disk — that read-only
// guarantee is what lets the checker run as a read-only subagent.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// fs walk
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage',
  '.cache', '.turbo', 'vendor',
]);

// generated artifacts the compiler emits — never treated as source
const GENERATED = new Set([
  '_ds_bundle.js', '_ds_manifest.json', '_adherence.oxlintrc.json',
]);

function walk(root) {
  const out = [];
  const rec = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.') continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        rec(abs);
      } else if (e.isFile()) {
        if (GENERATED.has(e.name)) continue;
        out.push(abs);
      }
    }
  };
  rec(root);
  return out;
}

const rel = (root, abs) => path.relative(root, abs).split(path.sep).join('/');
const read = (abs) => fs.readFileSync(abs, 'utf8');

// ---------------------------------------------------------------------------
// global CSS entry + @import closure
// ---------------------------------------------------------------------------

const CSS_ENTRY_NAMES = [
  'styles.css', 'index.css', 'globals.css', 'global.css',
  'main.css', 'theme.css', 'app.css', 'tokens.css',
];

function findGlobalCssEntry(root, files) {
  const cssRel = files
    .filter((f) => f.endsWith('.css'))
    .map((f) => rel(root, f));
  // prefer a known entry name at the shallowest depth, in preference order
  for (const name of CSS_ENTRY_NAMES) {
    const matches = cssRel
      .filter((r) => path.posix.basename(r) === name)
      .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
    if (matches.length) return matches[0];
  }
  return null;
}

// Fallback when the filename heuristic misses: trust the compiled manifest's
// recorded closure. Its LAST entry is the importer/entry file (post-order), so
// for a single-file closure it's the file itself. Returned only if it still
// exists on disk; otherwise null (caller falls through to the warning). This is
// what lets an SPA-extracted system (e.g. `colors_and_type.css`) resolve its
// tokens without hardcoding every possible entry name.
function manifestCssEntry(root) {
  try {
    const m = JSON.parse(read(path.join(root, '_ds_manifest.json')));
    const paths = Array.isArray(m && m.globalCssPaths) ? m.globalCssPaths : [];
    if (!paths.length) return null;
    const entry = paths[paths.length - 1];
    if (entry && fs.existsSync(path.join(root, entry))) return entry;
  } catch { /* no/invalid manifest */ }
  return null;
}

const IMPORT_RE = /@import\s+(?:url\(\s*)?["']([^"')]+)["']\s*\)?\s*;/g;

// post-order @import closure: each file's imports come before the file itself.
function resolveCssClosure(root, entryRel) {
  const order = [];
  const seen = new Set();
  const visit = (relPath) => {
    if (seen.has(relPath)) return;
    seen.add(relPath);
    const abs = path.join(root, relPath);
    let css;
    try { css = read(abs); } catch { return; }
    let m;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(css))) {
      let spec = m[1].trim();
      if (/^https?:/i.test(spec)) continue; // skip remote imports
      const childRel = path.posix.normalize(
        path.posix.join(path.posix.dirname(relPath), spec),
      );
      visit(childRel);
    }
    order.push(relPath);
  };
  visit(entryRel);
  return order;
}

// ---------------------------------------------------------------------------
// tokens + value-first classification
// ---------------------------------------------------------------------------

const DECL_RE =
  /(--[A-Za-z0-9-]+)\s*:\s*([^;]+);[ \t]*(?:\/\*\s*@kind\s+([A-Za-z]+)\s*\*\/)?/g;

const NAMED_COLORS = new Set([
  'transparent', 'currentcolor', 'black', 'white', 'red', 'green', 'blue',
  'gray', 'grey',
]);

function makeResolver(valueByName) {
  const VAR_RE = /^var\(\s*(--[A-Za-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/;
  return function resolve(v, depth = 0) {
    if (depth > 10) return v;
    const m = VAR_RE.exec(String(v).trim());
    if (m) {
      const ref = valueByName.get(m[1]);
      if (ref !== undefined) return resolve(ref, depth + 1);
      if (m[2]) return resolve(m[2].trim(), depth + 1);
    }
    return v;
  };
}

function classifyByValue(raw, resolve) {
  const v = String(resolve(raw)).trim();
  const hasColor =
    /#[0-9a-fA-F]{3,8}\b/.test(v) ||
    /\b(rgba?|hsla?|okl?ch|oklab|lab|lch|hwb|color)\(/.test(v) ||
    NAMED_COLORS.has(v.toLowerCase());
  const hasLen =
    /(^|[\s,(])-?\d*\.?\d+(px|rem|em|vh|vw|vmin|vmax|%|pt)\b/.test(v);
  if (hasColor && hasLen) return 'shadow';
  if (hasColor) return 'color';
  if (hasLen) return 'spacing';
  return null; // unclassifiable by value
}

function extractTokens(root, globalCssPaths) {
  const raw = []; // {name, value, annotation, definedIn}
  const valueByName = new Map();
  for (const relPath of globalCssPaths) {
    let css;
    try { css = read(path.join(root, relPath)); } catch { continue; }
    let m;
    DECL_RE.lastIndex = 0;
    while ((m = DECL_RE.exec(css))) {
      const name = m[1];
      const value = m[2].trim();
      // A real custom-property value never contains an unescaped brace. When it
      // does, DECL_RE straddled a selector/block boundary — e.g. the BEM rule
      // `.s2-btn--primary:hover { background: ...; }` mis-reads as a declaration
      // `--primary: hover { background: ...`. Skip these phantom matches.
      if (value.includes('{') || value.includes('}')) continue;
      const annotation = m[3] || null;
      raw.push({ name, value, annotation, definedIn: relPath });
      valueByName.set(name, value);
    }
  }
  const resolve = makeResolver(valueByName);
  const tokens = [];
  const unclassified = [];
  for (const t of raw) {
    let kind;
    if (t.annotation) {
      kind = t.annotation;
    } else {
      kind = classifyByValue(t.value, resolve);
      if (!kind) {
        unclassified.push(t.name);
        kind = 'other';
      }
    }
    const entry = { name: t.name, value: t.value, kind, definedIn: t.definedIn };
    if (t.annotation) entry.annotation = t.annotation;
    tokens.push(entry);
  }
  return { tokens, unclassified, valueByName };
}

// ---------------------------------------------------------------------------
// component modules + exports
// ---------------------------------------------------------------------------

const SOURCE_EXT = /\.(jsx|tsx)$/;

// Collect top-level export names in source order. Handles the patterns the
// reference uses (`export function X`, `export const x`) plus common variants.
function collectExports(src) {
  const found = []; // {name, index}
  const push = (name, index) => {
    if (name && !found.some((f) => f.name === name)) found.push({ name, index });
  };
  let m;
  const fn = /\bexport\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g;
  while ((m = fn.exec(src))) push(m[1], m.index);
  const cls = /\bexport\s+(?:default\s+)?class\s+([A-Za-z0-9_$]+)/g;
  while ((m = cls.exec(src))) push(m[1], m.index);
  const decl = /\bexport\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g;
  while ((m = decl.exec(src))) push(m[1], m.index);
  const named = /\bexport\s*\{([^}]*)\}/g;
  while ((m = named.exec(src))) {
    const idx = m.index;
    for (const part of m[1].split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const as = /\bas\s+([A-Za-z0-9_$]+)$/.exec(seg);
      const name = as ? as[1] : seg.split(/\s+/)[0];
      if (/^[A-Za-z0-9_$]+$/.test(name) && name !== 'default') push(name, idx);
    }
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.name);
}

const isCapitalized = (name) => /^[A-Z]/.test(name);

// ---------------------------------------------------------------------------
// .d.ts prop contracts
// ---------------------------------------------------------------------------

// Regex-level .d.ts reading, not a TypeScript parser. It covers the contract
// shape the authoring guide mandates — flat interfaces, optional per-member
// JSDoc, string-literal unions (single- or double-quoted, inline or multi-line
// leading-pipe), one alias hop (`name?: IconName`) — and fails open on
// anything else: an unreadable member just carries no values.

const TYPE_ALIAS_RE =
  /(?:^|\n)[ \t]*(?:export\s+)?(?:declare\s+)?type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^;]+);/g;
const IFACE_HEAD_RE =
  /(?:^|\n)[ \t]*(?:export\s+)?(?:declare\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)\b[^{]*\{/g;
const MEMBER_RE =
  /(?:^|\n)[ \t]*(?:\/\*\*([\s\S]*?)\*\/\s*)?(?:readonly\s+)?([A-Za-z_$][A-Za-z0-9_$]*)(\?)?\s*:\s*([^;]+);/g;

function unionLiterals(typeText) {
  const t = String(typeText).replace(/\s+/g, ' ').trim().replace(/^\|\s*/, '');
  const parts = t.split('|').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const values = [];
  for (const p of parts) {
    const m = /^(['"])(.*)\1$/.exec(p);
    if (!m) return null;
    values.push(m[2]);
  }
  return values;
}

export function parseDtsInterfaces(dtsSrc) {
  const src = String(dtsSrc ?? '');
  const aliases = new Map();
  let m;
  TYPE_ALIAS_RE.lastIndex = 0;
  while ((m = TYPE_ALIAS_RE.exec(src))) aliases.set(m[1], m[2].trim());

  const interfaces = [];
  IFACE_HEAD_RE.lastIndex = 0;
  while ((m = IFACE_HEAD_RE.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 1;
    let body = '';
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) break; }
      body += ch;
      i++;
    }
    const props = [];
    // split single-line interfaces onto rows so the line-anchored member regex
    // sees every member, while function types (`onChange?: (v) => void`) still
    // read as one member because their parens hold no `;`
    const norm = body.replace(/;/g, ';\n');
    let pm;
    MEMBER_RE.lastIndex = 0;
    while ((pm = MEMBER_RE.exec(norm))) {
      const doc = pm[1] || '';
      const name = pm[2];
      const typeText = pm[4].trim();
      let values = unionLiterals(typeText);
      if (!values && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(typeText) && aliases.has(typeText)) {
        values = unionLiterals(aliases.get(typeText));
      }
      const prop = { name };
      if (values && values.length) prop.values = values;
      else prop.type = typeText.replace(/\s+/g, ' ');
      const dm = /@default\s+("?)([^\s*"]+)\1/.exec(doc);
      if (dm) prop.default = dm[2];
      props.push(prop);
    }
    interfaces.push({ name: m[1], props });
  }
  return interfaces;
}

// ---------------------------------------------------------------------------
// @dsCard cards + @startingPoint starting points
// ---------------------------------------------------------------------------

function parseAttrs(s) {
  const out = {};
  const re = /([A-Za-z][A-Za-z0-9_-]*)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(s))) out[m[1]] = m[2];
  return out;
}

function firstLines(src, n) {
  return src.split(/\r?\n/, n + 1).slice(0, n);
}

// find an HTML comment whose body starts with @<tag> within the first `n` lines
function findTagComment(src, tag, n = 6) {
  const head = firstLines(src, n).join('\n');
  const re = new RegExp(`<!--\\s*@${tag}\\b([^]*?)-->`);
  const m = re.exec(head);
  return m ? parseAttrs(m[1]) : null;
}

// ---------------------------------------------------------------------------
// brand fonts
// ---------------------------------------------------------------------------

const SYSTEM_FONTS = new Set([
  'sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif',
  'ui-monospace', 'cursive', 'fantasy', 'emoji', 'math', 'fangsong',
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'segoe ui web (west european)',
  'segoe ui variable', 'segoe ui emoji', 'segoe ui symbol', 'apple color emoji',
  'roboto', 'helvetica neue', 'helvetica', 'arial', 'consolas', 'courier new',
  'courier', 'menlo', 'monaco', 'sf mono', 'georgia', 'times new roman', 'times',
  'cambria', 'tahoma', 'verdana', 'segoe ui mono', 'liberation mono',
  'noto sans', 'noto serif', 'inter', // common installed defaults
]);

function splitFamilies(value) {
  return value
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean);
}

function detectFonts(root, tokens, globalCssPaths) {
  // @font-face families that actually load a face
  const faceFamilies = new Set();
  const faceIssues = [];
  for (const relPath of globalCssPaths) {
    let css;
    try { css = read(path.join(root, relPath)); } catch { continue; }
    const faceRe = /@font-face\s*\{([^}]*)\}/g;
    let m;
    while ((m = faceRe.exec(css))) {
      const block = m[1];
      const fam = /font-family\s*:\s*([^;]+);/i.exec(block);
      if (fam) faceFamilies.add(fam[1].trim().replace(/^['"]|['"]$/g, '').toLowerCase());
      const src = /src\s*:\s*([^;]+);/i.exec(block);
      if (src) {
        const urls = [...src[1].matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((u) => u[1]);
        for (const u of urls) {
          if (/^(https?:|data:)/i.test(u)) continue;
          const abs = path.join(root, path.posix.dirname(relPath), u);
          if (!fs.existsSync(abs)) {
            faceIssues.push(`@font-face src not found: \`${u}\` (in ${relPath})`);
          }
        }
      }
    }
  }
  // brand fonts: families named in --fontFamily* tokens that have no @font-face
  // and are not a system/generic keyword
  const brandMap = new Map(); // family -> {family, tokens:Set, path}
  for (const t of tokens) {
    if (!/^--fontFamily/i.test(t.name)) continue;
    for (const fam of splitFamilies(t.value)) {
      const key = fam.toLowerCase();
      if (SYSTEM_FONTS.has(key) || faceFamilies.has(key)) continue;
      if (/^var\(/i.test(fam) || /\$/.test(fam)) continue;
      if (!brandMap.has(fam)) brandMap.set(fam, { family: fam, tokens: new Set(), path: t.definedIn });
      brandMap.get(fam).tokens.add(t.name);
    }
  }
  const brandFonts = [...brandMap.values()].map((b) => ({
    family: b.family,
    status: 'no-face',
    tokens: [...b.tokens],
    path: b.path,
  }));
  const fonts = [...faceFamilies].map((f) => ({ family: f }));
  return { fonts, brandFonts, faceIssues };
}

// ---------------------------------------------------------------------------
// namespace
// ---------------------------------------------------------------------------

function pascalCase(s) {
  const words = String(s)
    .replace(/[_\-./]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('') || 'DesignSystem';
}

function resolveNamespace(root, projectName) {
  // 1. existing manifest
  try {
    const m = JSON.parse(read(path.join(root, '_ds_manifest.json')));
    if (m && typeof m.namespace === 'string' && m.namespace) return m.namespace;
  } catch { /* none */ }
  // 2. existing bundle header
  try {
    const head = read(path.join(root, '_ds_bundle.js')).split(/\r?\n/, 1)[0];
    const m = /@ds-bundle:\s*(\{[^]*?\})\s*\*\//.exec(head);
    if (m) {
      const meta = JSON.parse(m[1]);
      if (meta.namespace) return meta.namespace;
    }
  } catch { /* none */ }
  // 3. derive fresh, deterministic from the project name
  const hash = crypto.createHash('sha256').update(projectName).digest('hex').slice(0, 6);
  return `${pascalCase(projectName)}_${hash}`;
}

// ---------------------------------------------------------------------------
// risky top-level globals in text/babel blocks
// ---------------------------------------------------------------------------

// Browser Babel injects each transpiled text/babel block as a classic script
// and rewrites top-level const/let to var, so every top-level binding becomes a
// window property. These window names carry accessor or side-effect semantics
// (window.status coerces to string, window.location navigates, …): a card that
// shadows one dies with an uncaught pageerror most console tooling never shows.
const RISKY_GLOBALS = new Set([
  'status', 'name', 'length', 'top', 'self', 'parent', 'origin', 'event',
  'location', 'history', 'frames', 'closed', 'opener', 'open', 'close',
  'stop', 'print', 'focus', 'blur', 'screen', 'scroll',
]);

const BABEL_BLOCK_RE =
  /<script[^>]*\btype=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/gi;
// column-0 only: authored card code indents nested declarations, and demanding
// the column keeps strings/JSX text from ever producing a false positive
const DECL_LINE_RE =
  /^(?:export\s+)?(?:async\s+)?(?:const|let|var|class|function\s*\*?)\s+(?:([A-Za-z_$][A-Za-z0-9_$]*)|\{([^}]*)\}|\[([^\]]*)\])/;

function destructuredNames(inner) {
  return inner
    .split(',')
    .map((part) => {
      const p = part.split('=')[0].replace(/^\s*\.\.\./, '').trim();
      if (!p) return '';
      const colon = p.indexOf(':');
      return (colon >= 0 ? p.slice(colon + 1) : p).trim();
    })
    .filter((n) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n));
}

function riskyTopLevelGlobals(html) {
  const found = new Set();
  let bm;
  BABEL_BLOCK_RE.lastIndex = 0;
  while ((bm = BABEL_BLOCK_RE.exec(html))) {
    const code = bm[1]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/`[\s\S]*?`/g, '""')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    for (const line of code.split(/\r?\n/)) {
      const dm = DECL_LINE_RE.exec(line);
      if (!dm) continue;
      const names = dm[1] ? [dm[1]] : destructuredNames(dm[2] ?? dm[3] ?? '');
      for (const n of names) if (RISKY_GLOBALS.has(n)) found.add(n);
    }
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// model assembly
// ---------------------------------------------------------------------------

export function buildModel(projectDir) {
  const root = path.resolve(projectDir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Not a directory: ${projectDir}`);
  }
  const projectName = path.basename(root);
  const files = walk(root);
  const issues = [];

  // --- global CSS + tokens ---
  // Prefer the filename heuristic; when it misses, fall back to the compiled
  // manifest's recorded entry, then ALWAYS recompute the closure (so a newly
  // added @import is still picked up on recompile).
  let globalCssEntry = findGlobalCssEntry(root, files);
  if (!globalCssEntry) globalCssEntry = manifestCssEntry(root);
  let globalCssPaths = [];
  let tokenInfo = { tokens: [], unclassified: [], valueByName: new Map() };
  if (globalCssEntry) {
    globalCssPaths = resolveCssClosure(root, globalCssEntry);
    tokenInfo = extractTokens(root, globalCssPaths);
  } else {
    issues.push(
      'No global CSS entry found (expected styles.css / index.css / globals.css / main.css). Tokens cannot be extracted.',
    );
  }
  const { tokens, unclassified } = tokenInfo;

  // --- fonts ---
  const { fonts, brandFonts, faceIssues } = detectFonts(root, tokens, globalCssPaths);
  for (const fi of faceIssues) issues.push(fi);

  // --- component modules ---
  const sourceFiles = files
    .filter((f) => SOURCE_EXT.test(f))
    .map((f) => rel(root, f))
    .sort();
  const dtsFiles = new Set(
    files.filter((f) => f.endsWith('.d.ts')).map((f) => rel(root, f)),
  );

  const allSources = []; // {path, exports, isModule, dtsPath}
  const components = [];
  const unexposedExports = [];
  const nameOwners = new Map(); // exposed name -> [paths]

  for (const sp of sourceFiles) {
    const stem = path.posix.basename(sp).replace(SOURCE_EXT, '');
    const dir = path.posix.dirname(sp);
    const dtsPath = (dir === '.' ? `${stem}.d.ts` : `${dir}/${stem}.d.ts`);
    const isModule = dtsFiles.has(dtsPath);
    let src = '';
    try { src = read(path.join(root, sp)); } catch { /* skip */ }
    const exports = collectExports(src);
    allSources.push({ path: sp, exports, isModule, dtsPath, stem });
    if (isModule) {
      let dts = '';
      try { dts = read(path.join(root, dtsPath)); } catch { /* fail open */ }
      const interfaces = parseDtsInterfaces(dts);
      for (const name of exports) {
        if (isCapitalized(name)) {
          const entry = { name, sourcePath: sp };
          if (!/[a-z]/.test(name)) {
            entry.kind = 'constant';
          } else {
            const iface =
              interfaces.find((x) => x.name === `${name}Props`) ||
              interfaces.find((x) => x.name === name);
            if (iface && iface.props.length) entry.props = iface.props;
          }
          components.push(entry);
          if (!nameOwners.has(name)) nameOwners.set(name, []);
          nameOwners.get(name).push(sp);
        } else {
          unexposedExports.push({ name, sourcePath: sp });
        }
      }
    }
  }

  // orphan .d.ts (no sibling source)
  for (const d of dtsFiles) {
    const stem = path.posix.basename(d).replace(/\.d\.ts$/, '');
    const dir = path.posix.dirname(d);
    const hasJsx = sourceFiles.some((sp) => {
      const sStem = path.posix.basename(sp).replace(SOURCE_EXT, '');
      return path.posix.dirname(sp) === dir && sStem === stem;
    });
    if (!hasJsx) issues.push(`Orphan \`${d}\` — no matching component file (${dir}/${stem}.jsx|.tsx).`);
  }

  // duplicate exposed component names
  for (const [name, owners] of nameOwners) {
    if (owners.length > 1) {
      issues.push(`Duplicate component name \`${name}\` exported by: ${owners.join(', ')}.`);
    }
  }

  // --- cards (@dsCard) ---
  const htmlFiles = files.filter((f) => f.endsWith('.html')).map((f) => rel(root, f));
  const cards = [];
  const cardByDir = new Map(); // dir -> first card path
  for (const hp of htmlFiles.slice().sort()) {
    let src = '';
    try { src = read(path.join(root, hp)); } catch { continue; }
    const attrs = findTagComment(src, 'dsCard', 4);
    if (!attrs) continue;
    cards.push({
      path: hp,
      group: attrs.group || 'Other',
      viewport: attrs.viewport || '',
      subtitle: attrs.subtitle || '',
      name: attrs.name || path.posix.basename(hp),
    });
    const dir = path.posix.dirname(hp);
    if (!cardByDir.has(dir)) cardByDir.set(dir, hp);
  }
  cards.sort((a, b) => a.group.localeCompare(b.group) || a.path.localeCompare(b.path));

  // HTML that sources a *component module* .jsx directly instead of the bundle.
  // (A screen loading its own local, non-module .jsx parts is the normal
  // multi-file-prototype pattern and is NOT flagged.)
  const moduleSet = new Set(allSources.filter((s) => s.isModule).map((s) => s.path));
  for (const hp of htmlFiles) {
    let src = '';
    try { src = read(path.join(root, hp)); } catch { continue; }
    const dir = path.posix.dirname(hp);
    const srcRe = /<script[^>]+src=["']([^"']+\.(?:jsx|tsx))["']/g;
    let m;
    while ((m = srcRe.exec(src))) {
      const spec = m[1];
      if (/^(https?:)?\/\//.test(spec)) continue;
      const resolved = path.posix.normalize(path.posix.join(dir, spec));
      if (moduleSet.has(resolved)) {
        const comp = path.posix.basename(resolved).replace(SOURCE_EXT, '');
        issues.push(`\`${hp}\` sources component module \`${resolved}\` directly — reference it through \`_ds_bundle.js\` (\`window.<Namespace>.${comp}\`) instead.`);
      }
    }
    for (const g of riskyTopLevelGlobals(src)) {
      issues.push(
        `\`${hp}\`: top-level \`${g}\` in a text/babel script collides with \`window.${g}\` ` +
        'once Babel injects the transpiled classic script (top-level const/let become var) — ' +
        'the card can die with a pageerror the console never shows. Rename the binding.',
      );
    }
  }

  // --- starting points ---
  const startingPoints = [];
  // component starting points: from .d.ts @startingPoint JSDoc
  for (const s of allSources) {
    if (!s.isModule) continue;
    let dts = '';
    try { dts = read(path.join(root, s.dtsPath)); } catch { continue; }
    const m = /@startingPoint\b([^\n*]*)/.exec(dts);
    if (!m) continue;
    const attrs = parseAttrs(m[1]);
    const dir = path.posix.dirname(s.path);
    const previewPath = cardByDir.get(dir) || s.path;
    // primary component = exposed export matching the file stem, else first exposed
    const exposed = s.exports.filter(isCapitalized);
    const name = exposed.includes(s.stem) ? s.stem : (exposed[0] || s.stem);
    startingPoints.push({
      name,
      path: s.path,
      previewPath,
      kind: 'component',
      section: attrs.section || '',
      subtitle: attrs.subtitle || '',
      viewport: attrs.viewport || '',
    });
  }
  // screen starting points: from .html @startingPoint comment
  for (const hp of htmlFiles) {
    let src = '';
    try { src = read(path.join(root, hp)); } catch { continue; }
    const attrs = findTagComment(src, 'startingPoint', 6);
    if (!attrs) continue;
    const dir = path.posix.dirname(hp);
    const name = dir === '.' ? path.posix.basename(hp).replace(/\.html$/, '') : path.posix.basename(dir);
    startingPoints.push({
      name,
      path: hp,
      previewPath: hp,
      kind: 'screen',
      section: attrs.section || '',
      subtitle: attrs.subtitle || '',
      viewport: attrs.viewport || '',
    });
  }
  startingPoints.sort((a, b) => {
    const ak = a.kind === 'screen' ? 1 : 0;
    const bk = b.kind === 'screen' ? 1 : 0;
    return ak - bk || a.path.localeCompare(b.path);
  });

  // --- namespace ---
  const namespace = resolveNamespace(root, projectName);

  // --- stale readme (light heuristic) ---
  const readmeRel = files.map((f) => rel(root, f)).find((r) => /^readme\.md$/i.test(r));
  if (readmeRel) {
    let readme = '';
    try { readme = read(path.join(root, readmeRel)); } catch { /* */ }
    const nsRefs = [...readme.matchAll(/window\.([A-Za-z0-9_]+_[0-9a-f]{6})\b/g)].map((m) => m[1]);
    for (const ns of nsRefs) {
      if (ns !== namespace) {
        issues.push(`\`${readmeRel}\` references stale namespace \`window.${ns}\` (current is \`${namespace}\`).`);
        break;
      }
    }
  }

  // --- unclassified-token warning (the headline checker issue) ---
  if (unclassified.length) {
    const head = unclassified.slice(0, 10).map((n) => `\`${n}\``).join(', ');
    const more = unclassified.length > 10 ? `, +${unclassified.length - 10} more` : '';
    issues.push(
      `${unclassified.length} of ${tokens.length} tokens couldn't be classified as ` +
      `color/spacing/radius/shadow/font from name or value: ${head}${more}. ` +
      'Add a `/* @kind color|spacing|radius|shadow|font */` comment after each ' +
      '(`/* @kind other */` marks a token as intentionally uncategorized), or rename to include the kind.',
    );
  }

  // token-kind histogram (for reports)
  const tokenHist = {};
  for (const t of tokens) tokenHist[t.kind] = (tokenHist[t.kind] || 0) + 1;

  return {
    namespace,
    source: 'spa',
    projectName,
    root,
    globalCssEntry,
    globalCssPaths,
    tokens,
    tokenHist,
    unclassified,
    components,
    unexposedExports,
    allSources,
    cards,
    startingPoints,
    fonts,
    themes: [],
    brandFonts,
    issues,
  };
}

export { pascalCase, collectExports, classifyByValue, makeResolver, riskyTopLevelGlobals };
