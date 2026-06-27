// CLI tests for agents/import-figma.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { AGENTS_DIR, tmpdir, write, read, exists, readJson, runScript } from './helpers.mjs';

const SCRIPT = 'import-figma.mjs';
const MINIMAL_FIG = path.join(AGENTS_DIR, 'tests/fixtures/minimal.fig');

test('usage: no subcommand → exit 64 with usage text', () => {
  const r = runScript(SCRIPT, []);
  assert.equal(r.status, 64);
  assert.match(r.stderr, /Usage:/);
});

test('unknown subcommand → exit 64', () => {
  const r = runScript(SCRIPT, ['frobnicate', 'x.fig']);
  assert.equal(r.status, 64);
});

test('outline: missing file → exit 1 with a helpful error', () => {
  const r = runScript(SCRIPT, ['outline', '/nonexistent/file.fig']);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.length > 0);
});

test('outline: a non-fig file is rejected, not decoded', (t) => {
  const dir = tmpdir(t);
  const fake = write(dir, 'fake.fig', 'this is not a figma export');
  const r = runScript(SCRIPT, ['outline', fake]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\.fig/i);
});

test('outline: decodes the fixture and reports pages/components', () => {
  const r = runScript(SCRIPT, ['outline', MINIMAL_FIG, '--json']);
  assert.equal(r.status, 0, r.stderr);

  const data = JSON.parse(r.stdout);
  assert.equal(data.container, 'zip');
  assert.equal(data.nodes, 4);
  assert.equal(data.pages.length, 1);
  assert.equal(data.pages[0].name, 'Fixture Page');
  assert.deepEqual(
    data.pages[0].frames.map((f) => [f.name, f.guid, f.width, f.height]),
    [
      ['Fixture Frame', '1:2', 240, 120],
      ['Fixture Button', '1:3', 120, 40],
    ],
  );
  assert.equal(data.components.total, 1);
  assert.equal(data.components.plain, 1);
  assert.equal(data.components.list[0].name, 'FixtureButton');
  assert.equal(data.components.list[0].guid, '1:3');
});

test('mount: writes a decoded reference tree for the fixture', (t) => {
  const dir = tmpdir(t);
  const projectDir = path.join(dir, 'project');
  fs.mkdirSync(projectDir);

  const r = runScript(SCRIPT, ['mount', MINIMAL_FIG, projectDir]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Mounted "minimal\.fig"/);

  assert.ok(exists(projectDir, '_fig/minimal/README.md'));
  assert.ok(exists(projectDir, '_fig/minimal/METADATA.md'));
  assert.ok(exists(projectDir, '_fig/minimal/Fixture-Page/Fixture-Frame/index.jsx'));
  assert.ok(exists(projectDir, '_fig/minimal/Fixture-Page/components/FixtureButton/FixtureButton.jsx'));

  const index = readJson(projectDir, '_fig/minimal/node-index.json');
  assert.equal(index['1:1'], '/Fixture-Page');
  assert.equal(index['1:2'], '/Fixture-Page/Fixture-Frame');
  assert.equal(index['1:3'], '/Fixture-Page/components/FixtureButton');

  const frameJsx = read(projectDir, '_fig/minimal/Fixture-Page/Fixture-Frame/index.jsx');
  assert.match(frameJsx, /figma node: 1:2/);
});

test('design-system: emits a component system from the fixture', (t) => {
  const dir = tmpdir(t);
  const outDir = path.join(dir, 'fixture-ds');

  const r = runScript(SCRIPT, ['design-system', MINIMAL_FIG, outDir, '--name', 'Fixture DS']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /1 component\(s\)/);

  assert.ok(exists(outDir, 'README.md'));
  assert.ok(exists(outDir, 'styles.css'));
  assert.ok(exists(outDir, 'components/FixtureButton.jsx'));
  assert.ok(exists(outDir, 'components/FixtureButton.d.ts'));

  assert.match(read(outDir, 'README.md'), /# Fixture DS/);
  assert.match(read(outDir, 'styles.css'), /declared no variables/);
  assert.match(read(outDir, 'components/FixtureButton.jsx'), /export function FixtureButton/);
  assert.match(read(outDir, 'components/FixtureButton.jsx'), /figma node: 1:3/);
  assert.match(read(outDir, 'components/FixtureButton.d.ts'), /FixtureButtonProps/);
});
