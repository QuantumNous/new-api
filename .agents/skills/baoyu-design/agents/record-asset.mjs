#!/usr/bin/env node
// record-asset.mjs — record (or unrecord) a regular design project's UI
// deliverables as "assets" in <projectDir>/_d_meta.json. Run this after you
// create or finish a deliverable (an HTML page or .dc.html component) so
// _d_meta.json keeps an index of the project's UI entry points, their
// versions, viewports, and review status. It is independent of design systems:
// recording an asset also CREATES _d_meta.json for a project that has none
// yet (e.g. one that uses no design system).
//
// Usage:
//   record (default):
//     node record-asset.mjs <projectDir> <htmlPath> \
//       [--name "<displayName>"] [--inherit-from <existingPath>] \
//       [--subtitle "<text>"] [--status needs-review|approved|changes-requested] \
//       [--width <n>] [--height <n>] [--section "<text>"] [--chat-id <id>]
//   unrecord:
//     node record-asset.mjs <projectDir> --remove [<htmlPath>] \
//       [--name "<displayName>"] [--path <relPath>]
//
// <htmlPath> is the deliverable, given project-relative (e.g. "Welcome.html"); an
// absolute path or one that includes <projectDir> is normalized to project-relative
// POSIX before it is stored. If --name is omitted on record it is derived from the
// filename (basename minus .dc.html/.html). --chat-id is optional and normally
// omitted in Claude Code (no chat-id surface) — reserved for hosts that have one.
//
// Shares the asset model with the importer/host via lib/asset-store.mjs.
// Writes ONLY <projectDir>/_d_meta.json. Exit 64 usage, 1 error.

import fs from 'node:fs';
import path from 'node:path';
import {
  STATUS_VALUES,
  metaPathFor,
  getAssetBaseName,
  findAssetNameByPath,
  recordAssetVersion,
  unrecordAssetVersion,
  readMeta,
  bootstrapMeta,
  writeMeta,
} from './lib/asset-store.mjs';

// --- args ---------------------------------------------------------------------
// Unlike the other scripts (boolean flags only), record takes value flags, so
// each --flag here consumes the following token as its value.
const VALUE_FLAGS = new Set([
  '--name', '--inherit-from', '--subtitle', '--status',
  '--width', '--height', '--section', '--chat-id', '--path',
]);

const argv = process.argv.slice(2);
const opts = {};
const positional = [];
let remove = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--remove') { remove = true; continue; }
  if (VALUE_FLAGS.has(a)) { opts[a.slice(2)] = argv[++i]; continue; }
  if (a.startsWith('--')) usage(`unknown flag: ${a}`);
  positional.push(a);
}

function usage(msg) {
  if (msg) process.stderr.write(`record-asset: ${msg}\n`);
  process.stderr.write(
    'Usage:\n' +
    '  node record-asset.mjs <projectDir> <htmlPath> [--name N] [--inherit-from P]\n' +
    '       [--subtitle S] [--status needs-review|approved|changes-requested]\n' +
    '       [--width W] [--height H] [--section S] [--chat-id ID]\n' +
    '  node record-asset.mjs <projectDir> --remove [<htmlPath>] [--name N] [--path P]\n',
  );
  process.exit(64);
}

const projectDirArg = positional[0];
if (!projectDirArg) usage('missing <projectDir>');
const projectDir = path.resolve(projectDirArg);
const metaPath = metaPathFor(projectDir);
const relMeta = toPosix(path.relative(process.cwd(), metaPath)) || '_d_meta.json';

// --- path helpers -------------------------------------------------------------
function toPosix(p) { return p.split(path.sep).join('/'); }

// Normalize a deliverable path to project-relative POSIX. Accepts an absolute
// path, a cwd-relative path that includes <projectDir>, or an already
// project-relative path (the documented, common case).
function toProjectRel(raw) {
  if (!raw) return undefined;
  const absProject = path.resolve(projectDir);
  const absFromCwd = path.resolve(raw);
  if (absFromCwd === absProject) return undefined; // points at the project dir itself
  if (absFromCwd.startsWith(absProject + path.sep)) {
    return toPosix(path.relative(absProject, absFromCwd));
  }
  return toPosix(String(raw).replace(/^\.\//, ''));
}

// --- unrecord -----------------------------------------------------------------
if (remove) {
  if (!fs.existsSync(metaPath)) {
    process.stdout.write(`No ${relMeta}; nothing to remove.\n`);
    process.exit(0);
  }
  const name = opts['name'];
  const storedPath = toProjectRel(positional[1] || opts['path']);
  if (!name && !storedPath) usage('--remove needs --name and/or a path');

  let meta;
  try { meta = readMeta(metaPath); } catch (e) { fail(e); }
  const action = {};
  if (name) action.name = name;
  if (storedPath) action.path = storedPath;
  unrecordAssetVersion(meta, action);
  writeMeta(metaPath, meta);

  const remaining = meta.assets ? Object.keys(meta.assets).length : 0;
  if (name && !storedPath) process.stdout.write(`Removed asset "${name}".\n`);
  else process.stdout.write(`Unrecorded ${storedPath}${name ? ` from "${name}"` : ''}.\n`);
  process.stdout.write(
    remaining
      ? `${relMeta}: ${remaining} asset(s) remaining.\n`
      : `${relMeta}: no assets remaining.\n`,
  );
  process.exit(0);
}

// --- record -------------------------------------------------------------------
const storedPath = toProjectRel(positional[1] || opts['path']);
if (!storedPath) usage('missing <htmlPath>');

const status = opts['status'];
if (status !== undefined && !STATUS_VALUES.includes(status)) {
  usage(`invalid --status "${status}" (expected: ${STATUS_VALUES.join(' | ')})`);
}

let viewport;
if (opts['width'] !== undefined) {
  const width = Number(opts['width']);
  if (!Number.isFinite(width)) usage(`--width must be a number, got "${opts['width']}"`);
  viewport = { width };
  if (opts['height'] !== undefined) {
    const height = Number(opts['height']);
    if (!Number.isFinite(height)) usage(`--height must be a number, got "${opts['height']}"`);
    viewport.height = height;
  }
} else if (opts['height'] !== undefined) {
  usage('--height requires --width');
}

const action = { path: storedPath };
if (opts['name'] !== undefined) action.name = opts['name'];
if (opts['inherit-from'] !== undefined) action.inheritFrom = toProjectRel(opts['inherit-from']);
if (status !== undefined) action.status = status;
if (opts['subtitle'] !== undefined) action.subtitle = opts['subtitle'];
if (viewport !== undefined) action.viewport = viewport;
if (opts['section'] !== undefined) action.section = opts['section'];
if (opts['chat-id'] !== undefined) action.chatId = opts['chat-id'];

let meta;
try { meta = readMeta(metaPath); } catch (e) { fail(e); }
bootstrapMeta(meta);

// Resolve the asset name the way the store will, with a CLI-only final fallback
// to the filename so --name is rarely needed. Pin it onto the action.
let name = action.name;
if (!name && action.inheritFrom) name = findAssetNameByPath(meta, action.inheritFrom);
if (!name) name = getAssetBaseName(storedPath);
if (!name) usage('could not determine an asset name; pass --name');
action.name = name;

const wasUpdate = !!meta.assets?.[name]?.versions?.some((v) => v && v.path === storedPath);
recordAssetVersion(meta, action);
writeMeta(metaPath, meta);

const versions = meta.assets[name].versions;
const finalStatus = (versions.find((v) => v && v.path === storedPath) || {}).status;
const n = versions.length;
process.stdout.write(
  `${wasUpdate ? 'Updated' : 'Recorded'} asset "${name}" → ${storedPath}  ` +
  `(status: ${finalStatus}, ${n} version${n === 1 ? '' : 's'})\n`,
);
process.stdout.write(`${relMeta}: written.\n`);

function fail(e) {
  process.stderr.write(`record-asset: ${(e && e.message) || e}\n`);
  process.exit(1);
}
