// CLI tests for agents/record-asset.mjs (asset recording in _d_meta.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { tmpdir, exists, readJson, runScript } from './helpers.mjs';

const SCRIPT = 'record-asset.mjs';
const meta = (dir) => readJson(dir, '_d_meta.json');

test('usage errors exit 64', (t) => {
  const dir = tmpdir(t);
  assert.equal(runScript(SCRIPT, []).status, 64); // no projectDir
  assert.equal(runScript(SCRIPT, [dir]).status, 64); // no htmlPath
  assert.equal(runScript(SCRIPT, [dir, 'a.html', '--status', 'bogus']).status, 64);
  assert.equal(runScript(SCRIPT, [dir, 'a.html', '--height', '100']).status, 64); // height w/o width
  assert.equal(runScript(SCRIPT, [dir, 'a.html', '--width', 'abc']).status, 64);
  assert.equal(runScript(SCRIPT, [dir, 'a.html', '--bogus-flag']).status, 64);
  // --remove without --name/--path is a usage error once a meta file exists
  runScript(SCRIPT, [dir, 'a.html']);
  assert.equal(runScript(SCRIPT, [dir, '--remove']).status, 64);
});

test('record creates _d_meta.json with the bootstrapped shape', (t) => {
  const dir = tmpdir(t);
  const r = runScript(SCRIPT, [dir, 'Welcome.html', '--subtitle', 'First pass', '--width', '390', '--height', '844']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Recorded asset "Welcome" → Welcome\.html\s+\(status: needs-review, 1 version\)/);

  const m = meta(dir);
  assert.equal(m.type, 'design');
  assert.deepEqual(m.designSystems, []);
  assert.equal(m.primaryDesignSystem, null);
  assert.ok(m.createdAt && m.updatedAt);
  const v = m.assets.Welcome.versions[0];
  assert.equal(v.path, 'Welcome.html');
  assert.equal(v.subtitle, 'First pass');
  assert.deepEqual(v.viewport, { width: 390, height: 844 });
});

test('re-recording the same path updates in place; new path appends', (t) => {
  const dir = tmpdir(t);
  runScript(SCRIPT, [dir, 'Welcome.html']);
  const r = runScript(SCRIPT, [dir, 'Welcome.html', '--status', 'approved']);
  assert.match(r.stdout, /Updated asset "Welcome"/);
  assert.equal(meta(dir).assets.Welcome.versions.length, 1);
  assert.equal(meta(dir).assets.Welcome.versions[0].status, 'approved');

  runScript(SCRIPT, [dir, 'Welcome-v2.html', '--inherit-from', 'Welcome.html']);
  assert.equal(meta(dir).assets.Welcome.versions.length, 2);
});

test('absolute and dot-relative paths are stored project-relative POSIX', (t) => {
  const dir = tmpdir(t);
  runScript(SCRIPT, [dir, path.join(dir, 'pages', 'Home.html')]);
  runScript(SCRIPT, [dir, './About.html']);
  const m = meta(dir);
  assert.equal(m.assets.Home.versions[0].path, 'pages/Home.html');
  assert.equal(m.assets.About.versions[0].path, 'About.html');
});

test('.dc.html display-name derivation', (t) => {
  const dir = tmpdir(t);
  runScript(SCRIPT, [dir, 'components/Card.dc.html']);
  assert.ok(meta(dir).assets.Card);
});

test('--remove by path and by name', (t) => {
  const dir = tmpdir(t);
  runScript(SCRIPT, [dir, 'A.html']);
  runScript(SCRIPT, [dir, 'B.html']);

  const r1 = runScript(SCRIPT, [dir, '--remove', 'A.html']);
  assert.equal(r1.status, 0);
  assert.match(r1.stdout, /Unrecorded A\.html/);
  assert.ok(!meta(dir).assets.A);

  const r2 = runScript(SCRIPT, [dir, '--remove', '--name', 'B']);
  assert.match(r2.stdout, /Removed asset "B"/);
  assert.match(r2.stdout, /no assets remaining/);
  assert.ok(!('assets' in meta(dir)));
});

test('--remove with no meta file is a friendly no-op', (t) => {
  const dir = tmpdir(t);
  const r = runScript(SCRIPT, [dir, '--remove', '--name', 'X']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /nothing to remove/);
  assert.ok(!exists(dir, '_d_meta.json'));
});
