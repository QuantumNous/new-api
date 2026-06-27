#!/usr/bin/env node
// compile-design-system.mjs — the WRITE step of the portable design-system
// pipeline. It reimplements the web product's "automated compiler": it reads a
// design-system folder, transpiles every component .jsx/.tsx with the vendored
// @babel/standalone (JSX/TSX → React.createElement, classic runtime), and emits
// the three artifacts the runtime cards load:
//
//   _ds_bundle.js            — one IIFE that defines window.<Namespace>.<Component>
//   _ds_manifest.json        — namespace, components, cards, starting points, tokens, fonts
//   _adherence.oxlintrc.json — lint config (raw hex/px + per-component prop whitelists)
//
// Usage: node compile-design-system.mjs <projectDir>
//
// Only THIS script writes; the parser (ds-core.mjs) and checker
// (check-design-system.mjs) write nothing.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { buildModel } from './lib/ds-core.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(new URL(import.meta.url).pathname);

// --- load vendored Babel (UMD → CJS) ------------------------------------------
let Babel;
try {
  Babel = require('./vendor/babel.min.js');
  if (!Babel || typeof Babel.transform !== 'function') {
    throw new Error('vendored Babel did not expose transform()');
  }
} catch (e) {
  process.stderr.write(
    `compile-design-system: could not load agents/vendor/babel.min.js — ${(e && e.message) || e}\n` +
    'Fetch it once with: curl -L https://unpkg.com/@babel/standalone@7.29.0/babel.min.js -o agents/vendor/babel.min.js\n',
  );
  process.exit(1);
}

// --- Babel plugin: strip ESM, keep React/window globals -----------------------
// The reference sources read deps from globals (`const React = window.React`,
// `const { Icon } = window.<NS>`) and use no ESM imports. Authored components
// may instead `import React from 'react'` and import siblings with relative
// paths — we strip react/react-dom imports and rewrite relative imports to
// read from __ds_scope, so both styles bundle.
function makeStripPlugin({ types: t }) {
  return {
    visitor: {
      ExportNamedDeclaration(p) {
        if (p.node.declaration) p.replaceWith(p.node.declaration);
        else p.remove();
      },
      ExportDefaultDeclaration(p) {
        const d = p.node.declaration;
        if (t.isFunctionDeclaration(d) || t.isClassDeclaration(d)) {
          if (d.id) p.replaceWith(d);
          else p.remove();
        } else {
          p.remove();
        }
      },
      ExportAllDeclaration(p) { p.remove(); },
      ImportDeclaration(p) {
        const src = p.node.source.value;
        if (src === 'react' || src === 'react-dom' || src === 'react-dom/client') {
          p.remove();
          return;
        }
        if (src.startsWith('.') || src.startsWith('/')) {
          // relative sibling import → pull the names out of __ds_scope
          const names = [];
          for (const s of p.node.specifiers) {
            if (t.isImportDefaultSpecifier(s) || t.isImportNamespaceSpecifier(s)) {
              names.push(t.objectProperty(t.identifier(s.local.name), t.identifier(s.local.name), false, true));
            } else if (t.isImportSpecifier(s)) {
              const imported = s.imported.name || s.imported.value;
              names.push(t.objectProperty(t.identifier(imported), t.identifier(s.local.name), false, imported === s.local.name));
            }
          }
          if (names.length) {
            p.replaceWith(
              t.variableDeclaration('const', [
                t.variableDeclarator(t.objectPattern(names), t.identifier('__ds_scope')),
              ]),
            );
          } else {
            p.remove();
          }
        }
        // bare external imports (e.g. a CDN lib) are left as-is for the author to resolve
      },
    },
  };
}

function transpile(code, file) {
  const isTsx = /\.tsx$/.test(file);
  const isTs = /\.tsx?$/.test(file);
  const presets = [['react', { runtime: 'classic' }]];
  if (isTs) presets.push(['typescript', { isTSX: isTsx, allExtensions: true }]);
  const out = Babel.transform(code, {
    filename: file,
    presets,
    plugins: [makeStripPlugin],
    sourceType: 'module',
    compact: false,
    comments: true,
    retainLines: false,
  });
  return out.code;
}

// --- bundle assembly ----------------------------------------------------------
function sourceHash(code) {
  return crypto.createHash('sha256').update(code).digest('hex').slice(0, 12);
}

// The strip plugin turns relative imports into EAGER `const { X } = __ds_scope`
// reads at the top of each file's IIFE block, so a dependency's block must run
// before its importers' — alphabetical order breaks whenever a dependency sorts
// after a dependent (e.g. components/Button.jsx importing ./Icon.jsx works, but
// ./Zicon.jsx would be undefined). DFS post-order over the already-alphabetical
// source list keeps output deterministic; files in an import cycle stay in list
// order (any order is wrong for a cycle — the per-block try/catch contains it).
function orderForBundle(allSources, rawByPath) {
  const byPath = new Map(allSources.map((s) => [s.path, s]));
  // single-statement match: [^;'"] can't cross a side-effect import's quote or
  // a statement boundary, while still spanning multi-line specifier lists
  const IMPORT_RE = /import\s+(?:[^;'"]*?\sfrom\s*)?["']([^"']+)["']/g;
  const EXTS = ['', '.jsx', '.tsx', '.js', '.ts', '/index.jsx', '/index.tsx', '/index.js', '/index.ts'];
  const resolveSpec = (importer, spec) => {
    const base = spec.startsWith('/')
      ? path.posix.normalize(spec.slice(1)) // treat /x/y as DS-root-relative
      : path.posix.normalize(path.posix.join(path.posix.dirname(importer), spec));
    for (const ext of EXTS) {
      if (byPath.has(base + ext)) return base + ext;
    }
    return null;
  };
  const deps = new Map();
  for (const s of allSources) {
    const out = [];
    const raw = rawByPath.get(s.path) ?? '';
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(raw))) {
      const spec = m[1];
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
      const target = resolveSpec(s.path, spec);
      if (target && target !== s.path) out.push(target);
    }
    deps.set(s.path, out);
  }
  const ordered = [];
  const state = new Map(); // 1 = visiting (cycle guard), 2 = emitted
  const visit = (p) => {
    if (state.get(p)) return;
    state.set(p, 1);
    for (const d of deps.get(p) ?? []) visit(d);
    state.set(p, 2);
    ordered.push(byPath.get(p));
  };
  for (const s of allSources) visit(s.path);
  return ordered;
}

function buildBundle(model) {
  const { root, namespace, components, unexposedExports, allSources } = model;
  const sourceHashes = {};
  const blocks = [];
  const exposed = new Set(components.map((c) => c.name));

  // read every source first: hashes stay in allSources (alphabetical) order so
  // the manifest is stable, while blocks emit in dependency order
  const rawByPath = new Map();
  for (const s of allSources) {
    let raw = '';
    try { raw = fs.readFileSync(path.join(root, s.path), 'utf8'); } catch { /* skip */ }
    rawByPath.set(s.path, raw);
    sourceHashes[s.path] = sourceHash(raw);
  }

  for (const s of orderForBundle(allSources, rawByPath)) {
    const raw = rawByPath.get(s.path) ?? '';
    let body;
    try {
      body = transpile(raw, s.path);
    } catch (e) {
      // a file that fails to transpile becomes a runtime error entry, matching
      // the bundle's per-file try/catch contract
      body = `throw new Error(${JSON.stringify('transpile failed: ' + ((e && e.message) || e))});`;
    }
    // a non-module file never writes a .d.ts-backed component's name into
    // __ds_scope — the module implementation must win the namespace slot
    const assignNames = s.isModule ? s.exports : s.exports.filter((n) => !exposed.has(n));
    const assign = assignNames.length
      ? `\nObject.assign(__ds_scope, { ${assignNames.join(', ')} });`
      : '';
    blocks.push(
      `// ${s.path}\n` +
      `try { (() => {\n${body}${assign}\n})(); } catch (e) { ` +
      `__ds_ns.__errors.push({ path: ${JSON.stringify(s.path)}, error: String((e && e.message) || e) }); }`,
    );
  }

  const meta = {
    format: 3,
    namespace,
    components: components.map((c) => ({ name: c.name, sourcePath: c.sourcePath })),
    sourceHashes,
    inlinedExternals: [],
    unexposedExports: unexposedExports.map((u) => ({ name: u.name, sourcePath: u.sourcePath })),
  };

  // .d.ts-backed components first, then PascalCase exports of non-module
  // sources — bundled and exposed, but with no props contract / adherence /
  // starting-point eligibility. A module component always keeps its name.
  const extraExposed = [];
  for (const s of allSources) {
    if (s.isModule) continue;
    for (const name of s.exports) {
      if (/^[A-Z]/.test(name) && !exposed.has(name)) {
        exposed.add(name);
        extraExposed.push(name);
      }
    }
  }
  const tail = components
    .map((c) => `__ds_ns.${c.name} = __ds_scope.${c.name};`)
    .concat(extraExposed.map((n) => `__ds_ns.${n} = __ds_scope.${n};`))
    .join('\n\n');

  return (
    `/* @ds-bundle: ${JSON.stringify(meta)} */\n\n` +
    `(() => {\n\n` +
    `const __ds_ns = (window.${namespace} = window.${namespace} || {});\n\n` +
    `const __ds_scope = {};\n\n` +
    `(__ds_ns.__errors = __ds_ns.__errors || []);\n\n` +
    blocks.join('\n\n') +
    `\n\n` +
    (tail ? tail + '\n\n' : '') +
    `})();\n`
  );
}

// --- manifest -----------------------------------------------------------------
function buildManifest(model) {
  return {
    namespace: model.namespace,
    components: model.components,
    startingPoints: model.startingPoints,
    cards: model.cards,
    globalCssPaths: model.globalCssPaths,
    tokens: model.tokens,
    themes: model.themes,
    fonts: model.fonts,
    brandFonts: model.brandFonts,
    source: model.source,
  };
}

// --- adherence lint config ----------------------------------------------------
// One JSX prop-whitelist per exposed component, from the props contract ds-core
// parses out of the module's .d.ts (`<Name>Props` interface; both quote styles,
// multi-line unions, one alias hop). Enum-typed props additionally get a VALUE
// rule, so a literal like variant="ghost" warns when the union lacks 'ghost'.
// Constant exports (ICON_NAMES) and components whose contract didn't parse get
// no rule — fail open. This is advisory lint config.
const ALWAYS_PROPS = ['key', 'ref', 'className', 'style', 'children'];
const reEsc = (s) => s.replace(/[/\\^$.*+?()[\]{}|]/g, '\\$&');

function buildAdherence(model) {
  // import-restriction groups: each directory that holds source files
  const dirs = [...new Set(model.allSources.map((s) => path.posix.dirname(s.path)))]
    .filter((d) => d && d !== '.')
    .sort()
    .map((d) => `${d}/**`);

  const syntax = [
    {
      selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
      message: 'Raw hex color — use a design-system color token via var().',
    },
    {
      selector: 'Literal[value=/\\b\\d+px\\b/]',
      message: 'Raw px value — use a design-system spacing token via var().',
    },
  ];

  const components = model.components
    .filter((c) => c.kind !== 'constant' && Array.isArray(c.props) && c.props.length)
    .slice()
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const { name, props } of components) {
    const allowed = [...new Set([...props.map((p) => p.name), ...ALWAYS_PROPS])];
    const allowedRe = `^(?:${allowed.join('|')})$`;
    syntax.push({
      selector: `JSXOpeningElement[name.name='${name}'] > JSXAttribute > JSXIdentifier[name!=/${allowedRe}/]`,
      message: `<${name}> doesn't accept that prop. Declared props: ${props.map((p) => p.name).join(', ')}.`,
    });
    for (const p of props) {
      if (!p.values || !p.values.length) continue;
      const valRe = `^(?:${p.values.map(reEsc).join('|')})$`;
      syntax.push({
        selector: `JSXOpeningElement[name.name='${name}'] > JSXAttribute[name.name='${p.name}'] > Literal[value!=/${valRe}/]`,
        message: `<${name}> ${p.name} must be one of ${p.values.map((v) => `'${v}'`).join(' | ')}.`,
      });
    }
  }

  const tokensSorted = model.tokens.map((t) => t.name).sort();
  const tokenKinds = {};
  for (const t of model.tokens) tokenKinds[t.name] = t.kind;
  const componentsMap = {};
  for (const { name } of components) componentsMap[name] = { replaces: [] };

  return {
    plugins: ['react', 'import'],
    rules: {
      'react/forbid-elements': ['warn', { forbid: [] }],
      'no-restricted-imports': ['warn', {
        patterns: [{
          group: dirs,
          message: "Import design-system components from 'index.js', not component internals.",
        }],
      }],
      'no-restricted-syntax': ['warn', ...syntax],
    },
    overrides: [{ files: ['**/index.js'], rules: { 'no-restricted-imports': 'off' } }],
    'x-omelette': {
      components: componentsMap,
      tokens: tokensSorted,
      tokenKinds,
      fontFamilies: model.fonts.map((f) => f.family),
    },
  };
}

// --- main ---------------------------------------------------------------------
const projectDir = process.argv[2];
if (!projectDir) {
  process.stderr.write('Usage: node compile-design-system.mjs <projectDir>\n');
  process.exit(64);
}

let model;
try {
  model = buildModel(projectDir);
} catch (e) {
  process.stderr.write(`compile-design-system: ${(e && e.message) || e}\n`);
  process.exit(1);
}

const bundle = buildBundle(model);
const manifest = buildManifest(model);
const adherence = buildAdherence(model);

const w = (name, content) => {
  fs.writeFileSync(path.join(model.root, name), content);
  return name;
};

w('_ds_bundle.js', bundle);
w('_ds_manifest.json', JSON.stringify(manifest, null, 2));
w('_adherence.oxlintrc.json', JSON.stringify(adherence, null, 2));

const hist = model.tokenHist;
const histStr = Object.keys(hist).sort().map((k) => `${k} ${hist[k]}`).join(', ');
const constCount = model.components.filter((c) => c.kind === 'constant').length;
const constSeg = constCount ? ` (+${constCount} constant export${constCount === 1 ? '' : 's'})` : '';
process.stdout.write(
  `Compiled ${model.namespace}: ${model.components.length - constCount} components${constSeg}, ` +
  `${model.cards.length} cards, ${model.startingPoints.length} starting points, ` +
  `${model.tokens.length} tokens (${histStr}).\n` +
  'Wrote _ds_bundle.js, _ds_manifest.json, _adherence.oxlintrc.json.\n' +
  (model.unclassified.length
    ? `Note: ${model.unclassified.length} tokens unclassified by value — add /* @kind */ comments.\n`
    : ''),
);
