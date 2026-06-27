// CLI tests for agents/import-design-system.mjs (sync a compiled DS into a
// project's _ds/<slug>/ and record the binding in _d_meta.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { tmpdir, write, read, exists, readJson, makeDsFixture, runScript } from './helpers.mjs';

const SCRIPT = 'import-design-system.mjs';

function compiledDsFixture(t) {
  const base = tmpdir(t);
  const dsDir = path.join(base, 'acme-ds');
  fs.mkdirSync(dsDir);
  makeDsFixture(dsDir);
  const r = runScript('compile-design-system.mjs', [dsDir]);
  assert.equal(r.status, 0, r.stderr);
  const projectDir = path.join(base, 'project');
  fs.mkdirSync(projectDir);
  return { dsDir, projectDir };
}

test('usage: missing args → exit 64', () => {
  assert.equal(runScript(SCRIPT, []).status, 64);
  assert.equal(runScript(SCRIPT, ['only-one']).status, 64);
});

test('refuses an uncompiled folder', (t) => {
  const dir = tmpdir(t);
  write(dir, 'ds/styles.css', ':root { --colorA: #000; }\n');
  fs.mkdirSync(path.join(dir, 'proj'));
  const r = runScript(SCRIPT, [path.join(dir, 'ds'), path.join(dir, 'proj')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not a compiled design system/);
});

test('imports the runtime subset and records the binding', (t) => {
  const { dsDir, projectDir } = compiledDsFixture(t);
  const r = runScript(SCRIPT, [dsDir, projectDir]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Imported "Acme Design System"/);

  const dest = '_ds/acme-ds';
  // CSS closure + url() font asset + artifacts + docs + generated prompt
  for (const f of [
    'tokens.css', 'styles.css', 'fonts/inter.woff2',
    '_ds_bundle.js', '_ds_manifest.json', '_adherence.oxlintrc.json',
    'README.md', '_ds_prompt.md',
  ]) {
    assert.ok(exists(projectDir, `${dest}/${f}`), `missing ${dest}/${f}`);
  }
  // source-only files stay out of the runtime copy
  assert.ok(!exists(projectDir, `${dest}/components/Button.jsx`));
  assert.ok(!exists(projectDir, `${dest}/components/Button.prompt.md`));

  // binding recorded; first import claims primary
  const meta = readJson(projectDir, '_d_meta.json');
  assert.equal(meta.designSystems.length, 1);
  const entry = meta.designSystems[0];
  assert.equal(entry.slug, 'acme-ds');
  assert.equal(entry.name, 'Acme Design System');
  assert.equal(entry.dsFolder, '_ds/acme-ds');
  assert.equal(meta.primaryDesignSystem, 'acme-ds');

  const manifest = readJson(projectDir, `${dest}/_ds_manifest.json`);
  assert.equal(entry.namespace, manifest.namespace);

  // generated prompt: binding, wiring, guide, excerpt, token allowlist
  const prompt = read(projectDir, `${dest}/_ds_prompt.md`);
  assert.ok(prompt.includes('binding'));
  assert.ok(prompt.includes(`window.${manifest.namespace}`));
  assert.ok(prompt.includes('_ds/acme-ds/_ds_bundle.js'));
  assert.ok(prompt.includes('<design-system-guide>'));
  assert.ok(prompt.includes('# Acme Design System'));
  assert.ok(prompt.includes('### components/Button.prompt.md'));
  assert.ok(prompt.includes('<Button label="Save" variant="primary" />'));
  assert.ok(prompt.includes('--colorPrimary'));

  // re-import is idempotent on the meta
  assert.equal(runScript(SCRIPT, [dsDir, projectDir]).status, 0);
  assert.equal(readJson(projectDir, '_d_meta.json').designSystems.length, 1);
});

test('import never touches the DS source tree', (t) => {
  const { dsDir, projectDir } = compiledDsFixture(t);
  const before = fs.readdirSync(dsDir, { recursive: true }).sort();
  runScript(SCRIPT, [dsDir, projectDir]);
  assert.deepEqual(fs.readdirSync(dsDir, { recursive: true }).sort(), before);
});

test('an uncompiled-bundle warning never blocks a stylesheet-only DS', (t) => {
  const dir = tmpdir(t);
  const dsDir = path.join(dir, 'css-only');
  write(dsDir, 'styles.css', ':root { --colorA: #000; }\n');
  // manifest marks it compiled, but there is no bundle (stylesheet-only system)
  write(dsDir, '_ds_manifest.json', JSON.stringify({ namespace: 'CssOnly_aaaaaa' }));
  const projectDir = path.join(dir, 'proj');
  fs.mkdirSync(projectDir);

  const r = runScript(SCRIPT, [dsDir, projectDir]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /_ds_bundle\.js is missing/);
  const prompt = read(projectDir, '_ds/css-only/_ds_prompt.md');
  assert.ok(prompt.includes('Loading the stylesheet(s) is how you use this design system.'));
});
