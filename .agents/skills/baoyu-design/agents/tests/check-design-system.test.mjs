// CLI tests for agents/check-design-system.mjs (read-only validator).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { tmpdir, write, makeDsFixture, runScript } from './helpers.mjs';

const SCRIPT = 'check-design-system.mjs';

test('usage: no args → exit 64', () => {
  const r = runScript(SCRIPT, []);
  assert.equal(r.status, 64);
  assert.match(r.stderr, /Usage:/);
});

test('clean fixture → exit 0, summary, no issues', (t) => {
  const root = makeDsFixture(tmpdir(t));
  const r = runScript(SCRIPT, [root]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Namespace: [A-Za-z0-9]+_[0-9a-f]{6}/);
  assert.match(r.stdout, /Components: 2 \(\+1 constant export: BUTTON_SIZES\)/);
  assert.match(r.stdout, /@dsCard cards: 1 \(Forms: 1\)/);
  assert.match(r.stdout, /Starting points: 2 \(Button, home\)/);
  assert.match(r.stdout, /Tokens: 6\./);
  assert.match(r.stdout, /No issues — clean/);
});

test('check writes nothing to the project', (t) => {
  const root = makeDsFixture(tmpdir(t));
  const before = fs.readdirSync(root, { recursive: true }).sort();
  runScript(SCRIPT, [root, '--verbose']);
  assert.deepEqual(fs.readdirSync(root, { recursive: true }).sort(), before);
});

test('--verbose adds token kinds, brand fonts, and the export map', (t) => {
  const root = makeDsFixture(tmpdir(t));
  const r = runScript(SCRIPT, [root, '--verbose']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Token kinds: color 2, font 1, other 1, shadow 1, spacing 1\./);
  assert.match(r.stdout, /Brand fonts.*Acme Sans \[--fontFamilyBase\]/);
  assert.match(r.stdout, /✓ Button — components\/Button\.jsx/);
  // PascalCase export of a non-module file is listed but not exposed
  assert.match(r.stdout, /· Badge — helpers\/Badge\.jsx/);
});

test('issues are listed and missing CSS entry exits 2', (t) => {
  const root = tmpdir(t);
  write(root, 'components/X.jsx', 'export function X() { return null; }\n');
  write(root, 'components/X.d.ts', 'export interface XProps {}\n');
  const r = runScript(SCRIPT, [root]);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /Issues to fix:/);
  assert.match(r.stdout, /No global CSS entry/);
});

test('nonexistent dir → exit 1', () => {
  const r = runScript(SCRIPT, ['/nonexistent/path/xyz']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Not a directory/);
});
