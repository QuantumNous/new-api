// CLI smoke tests for agents/build-preview.mjs (self-contained preview.html).
// Runs with --offline so the test never touches the network; the fixture's
// cards are static HTML, so no React/Babel inlining is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { tmpdir, read, exists, makeDsFixture, runScript } from './helpers.mjs';

const SCRIPT = 'build-preview.mjs';

test('usage: no args → non-zero exit', () => {
  const r = runScript(SCRIPT, []);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Usage:/);
});

test('builds one self-contained preview.html from the fixture', (t) => {
  const root = makeDsFixture(tmpdir(t));
  assert.equal(runScript('compile-design-system.mjs', [root]).status, 0);

  const out = path.join(root, 'preview.html');
  const r = runScript(SCRIPT, [root, '--out', out, '--title', 'Acme Preview', '--offline']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /wrote .*preview\.html/);

  assert.ok(exists(root, 'preview.html'));
  const html = read(root, 'preview.html');
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('Acme Preview'));
  assert.ok(html.includes('id="ds-data"'), 'embeds the card payload');
  assert.ok(html.includes('Buttons'), 'card title present');
  assert.ok(html.includes('Acme Design System'), 'readme rendered');
  // self-contained: the card's stylesheet is inlined, not linked relatively
  assert.ok(!html.includes('href="../styles.css"'));
});
