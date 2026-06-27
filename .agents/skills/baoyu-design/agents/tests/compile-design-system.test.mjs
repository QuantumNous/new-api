// CLI tests for agents/compile-design-system.mjs (the write step: bundle,
// manifest, adherence config).
import test from 'node:test';
import assert from 'node:assert/strict';

import { tmpdir, write, read, exists, readJson, makeDsFixture, runScript } from './helpers.mjs';

const SCRIPT = 'compile-design-system.mjs';

test('usage: no args → exit 64', () => {
  const r = runScript(SCRIPT, []);
  assert.equal(r.status, 64);
});

test('compiles the fixture into bundle + manifest + adherence', (t) => {
  const root = makeDsFixture(tmpdir(t));
  const r = runScript(SCRIPT, [root]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Compiled [A-Za-z0-9]+_[0-9a-f]{6}: 2 components \(\+1 constant export\)/);
  assert.match(r.stdout, /1 cards, 2 starting points, 6 tokens/);
  assert.ok(!/unclassified/.test(r.stdout));

  for (const f of ['_ds_bundle.js', '_ds_manifest.json', '_adherence.oxlintrc.json']) {
    assert.ok(exists(root, f), `missing ${f}`);
  }

  // --- manifest mirrors the model ---
  const manifest = readJson(root, '_ds_manifest.json');
  assert.match(manifest.namespace, /^[A-Za-z0-9]+_[0-9a-f]{6}$/);
  assert.deepEqual(manifest.globalCssPaths, ['tokens.css', 'styles.css']);
  assert.equal(manifest.tokens.length, 6);
  assert.equal(manifest.cards.length, 1);
  assert.equal(manifest.startingPoints.length, 2);
  const compNames = manifest.components.map((c) => c.name);
  assert.ok(compNames.includes('Button') && compNames.includes('Zicon'));

  // --- bundle: header meta, dependency order, executes against a window stub ---
  const bundle = read(root, '_ds_bundle.js');
  const headMeta = JSON.parse(/@ds-bundle:\s*(\{.*?\})\s*\*\//.exec(bundle.split('\n')[0])[1]);
  assert.equal(headMeta.namespace, manifest.namespace);
  assert.ok(Object.keys(headMeta.sourceHashes).includes('components/Button.jsx'));

  // Button imports ./Zicon.jsx, so Zicon's block must run first despite
  // alphabetical order putting Button first
  assert.ok(
    bundle.indexOf('// components/Zicon.jsx') < bundle.indexOf('// components/Button.jsx'),
    'dependency blocks must precede their importers',
  );

  const win = {};
  new Function('window', bundle)(win);
  const ns = win[manifest.namespace];
  assert.equal(typeof ns.Button, 'function');
  assert.equal(typeof ns.Zicon, 'function');
  assert.deepEqual(ns.BUTTON_SIZES, ['sm', 'md']);
  assert.equal(typeof ns.Badge, 'function', 'PascalCase non-module exports are exposed too');
  assert.deepEqual(ns.__errors, []);

  // --- adherence: prop + enum-value rules from the .d.ts contract ---
  const adherence = readJson(root, '_adherence.oxlintrc.json');
  const syntax = adherence.rules['no-restricted-syntax'].slice(1);
  assert.ok(syntax.some((s) => /Raw hex color/.test(s.message)));
  assert.ok(syntax.some((s) => s.message?.includes("<Button> doesn't accept that prop")));
  assert.ok(syntax.some((s) => s.message?.includes("variant must be one of 'primary' | 'ghost' | 'danger'")));
  assert.deepEqual(adherence['x-omelette'].tokens.length, 6);

  // --- recompile is stable: namespace persists via the manifest ---
  const r2 = runScript(SCRIPT, [root]);
  assert.equal(r2.status, 0);
  assert.equal(readJson(root, '_ds_manifest.json').namespace, manifest.namespace);
});

test('a file that fails to transpile becomes a contained runtime error', (t) => {
  const root = makeDsFixture(tmpdir(t));
  write(root, 'components/Broken.jsx', 'export function Broken( { return <div<; }\n');
  const r = runScript(SCRIPT, [root]);
  assert.equal(r.status, 0, 'one bad file must not fail the compile');

  const bundle = read(root, '_ds_bundle.js');
  assert.ok(bundle.includes('transpile failed'));

  const win = {};
  new Function('window', bundle)(win);
  const ns = win[readJson(root, '_ds_manifest.json').namespace];
  assert.equal(ns.__errors.length, 1);
  assert.equal(ns.__errors[0].path, 'components/Broken.jsx');
  assert.equal(typeof ns.Button, 'function', 'healthy components still load');
});

test('nonexistent dir → exit 1', () => {
  const r = runScript(SCRIPT, ['/nonexistent/path/xyz']);
  assert.equal(r.status, 1);
});
