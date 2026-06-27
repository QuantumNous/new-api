// Unit tests for agents/lib/asset-store.mjs — the _d_meta.json asset model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  STATUS_VALUES,
  META_FILE,
  metaPathFor,
  isRecord,
  getAssetBaseName,
  findAssetNameByPath,
  recordAssetVersion,
  unrecordAssetVersion,
  readMeta,
  bootstrapMeta,
  writeMeta,
} from '../lib/asset-store.mjs';
import { tmpdir, write } from './helpers.mjs';

test('constants and path helpers', () => {
  assert.deepEqual(STATUS_VALUES, ['needs-review', 'approved', 'changes-requested']);
  assert.equal(path.basename(metaPathFor('/x/proj')), META_FILE);
  assert.equal(getAssetBaseName('Welcome.html'), 'Welcome');
  assert.equal(getAssetBaseName('cards/Card.dc.html'), 'Card');
  assert.equal(getAssetBaseName('plain.txt'), 'plain.txt');
});

test('isRecord', () => {
  assert.equal(isRecord({}), true);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord('x'), false);
});

test('recordAssetVersion appends, updates in place, and resolves inheritFrom', () => {
  const meta = {};
  recordAssetVersion(meta, { name: 'Welcome', path: 'Welcome.html', subtitle: 'v1' });
  assert.equal(meta.assets.Welcome.versions.length, 1);
  const v1 = meta.assets.Welcome.versions[0];
  assert.equal(v1.status, 'needs-review'); // default
  assert.equal(v1.subtitle, 'v1');
  assert.ok(v1.createdAt);
  assert.ok(!('viewport' in v1) && !('chatId' in v1), 'undefined keys are never emitted');

  // same path → in-place update, no new version
  recordAssetVersion(meta, { name: 'Welcome', path: 'Welcome.html', status: 'approved' });
  assert.equal(meta.assets.Welcome.versions.length, 1);
  assert.equal(meta.assets.Welcome.versions[0].status, 'approved');

  // new path under the same asset via inheritFrom
  recordAssetVersion(meta, { inheritFrom: 'Welcome.html', path: 'Welcome-v2.html' });
  assert.equal(meta.assets.Welcome.versions.length, 2);
  assert.equal(findAssetNameByPath(meta, 'Welcome-v2.html'), 'Welcome');

  // unresolvable name → no-op
  recordAssetVersion(meta, { inheritFrom: 'nope.html', path: 'x.html' });
  assert.deepEqual(Object.keys(meta.assets), ['Welcome']);
});

test('recordAssetVersion viewport update keeps a previously recorded height', () => {
  const meta = {};
  recordAssetVersion(meta, { name: 'A', path: 'a.html', viewport: { width: 390, height: 844 } });
  recordAssetVersion(meta, { name: 'A', path: 'a.html', viewport: { width: 428 } });
  assert.deepEqual(meta.assets.A.versions[0].viewport, { width: 428, height: 844 });
});

test('unrecordAssetVersion removes by name, by path, and cleans up empties', () => {
  const meta = {};
  recordAssetVersion(meta, { name: 'A', path: 'a1.html' });
  recordAssetVersion(meta, { name: 'A', path: 'a2.html' });
  recordAssetVersion(meta, { name: 'B', path: 'b.html' });

  unrecordAssetVersion(meta, { path: 'a1.html' });
  assert.equal(meta.assets.A.versions.length, 1);

  unrecordAssetVersion(meta, { name: 'B' }); // whole asset
  assert.ok(!meta.assets.B);

  unrecordAssetVersion(meta, { path: 'a2.html' }); // last version → asset and map dropped
  assert.ok(!('assets' in meta));
});

test('unrecordAssetVersion scopes path removal to name when both given', () => {
  const meta = {};
  recordAssetVersion(meta, { name: 'A', path: 'shared.html' });
  recordAssetVersion(meta, { name: 'B', path: 'shared.html' });
  unrecordAssetVersion(meta, { name: 'A', path: 'shared.html' });
  assert.ok(!meta.assets.A);
  assert.equal(meta.assets.B.versions.length, 1);
});

test('readMeta: missing → {}, invalid JSON throws, non-record → {}', (t) => {
  const dir = tmpdir(t);
  assert.deepEqual(readMeta(path.join(dir, 'none.json')), {});
  write(dir, 'bad.json', '{nope');
  assert.throws(() => readMeta(path.join(dir, 'bad.json')), /not valid JSON/);
  write(dir, 'arr.json', '[1,2]');
  assert.deepEqual(readMeta(path.join(dir, 'arr.json')), {});
});

test('bootstrapMeta seeds the documented shape without clobbering', () => {
  const meta = bootstrapMeta({});
  assert.equal(meta.type, 'design');
  assert.deepEqual(meta.designSystems, []);
  assert.equal(meta.primaryDesignSystem, null);

  const kept = bootstrapMeta({ type: 'x', designSystems: [1], primaryDesignSystem: 'p' });
  assert.equal(kept.type, 'x');
  assert.deepEqual(kept.designSystems, [1]);
  assert.equal(kept.primaryDesignSystem, 'p');
});

test('writeMeta sets createdAt once, bumps updatedAt, pretty-prints with newline', (t) => {
  const dir = tmpdir(t);
  const metaPath = path.join(dir, 'sub', META_FILE); // mkdir -p behaviour
  const meta = { type: 'design' };
  writeMeta(metaPath, meta);
  const first = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  assert.ok(first.createdAt && first.updatedAt);

  writeMeta(metaPath, meta);
  const second = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  assert.equal(second.createdAt, first.createdAt);
  assert.ok(second.updatedAt >= first.updatedAt);
  assert.ok(fs.readFileSync(metaPath, 'utf8').endsWith('}\n'));
});
