// asset-store.mjs — the asset half of a project's _d_meta.json. Pure and dependency-
// free so the importer/recorder scripts and any host share one model for a
// project's recorded UI deliverables ("assets").
//
// An `asset` is a named UI entry point (an HTML page or .dc.html component); each
// asset holds an ordered list of `versions`. The shape, keyed by display name:
//
//   meta.assets = {
//     "<display name>": {
//       versions: [
//         { path, createdAt, status, chatId?, subtitle?, viewport?{width,height?}, section? }
//       ]
//     }
//   }
//
// status ∈ "needs-review" (default) | "approved" | "changes-requested".
//
// Mirrors lib/ds-core.mjs: node stdlib only, named exports, writes nothing on its
// own — meta is mutated in place and persisted by writeMeta().

import fs from 'node:fs';
import path from 'node:path';

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nowIso() {
  return new Date().toISOString();
}

const STATUS_VALUES = ['needs-review', 'approved', 'changes-requested'];

// Where a project's metadata lives: <projectDir>/_d_meta.json. The _d_ prefix
// (matching the _ds_manifest.json marker convention) namespaces our file at the
// project root so it never collides with a deliverable's own meta.json.
const META_FILE = '_d_meta.json';
const metaPathFor = (projectDir) => path.join(projectDir, META_FILE);

// Derive a display name from a deliverable path: basename minus .dc.html, then
// minus .html. "Welcome.html" → "Welcome", "Card.dc.html" → "Card".
function getAssetBaseName(p) {
  return (String(p).split('/').pop() || String(p))
    .replace(/\.dc\.html$/, '')
    .replace(/\.html$/, '');
}

// Find the asset name whose versions include `path`, or undefined.
function findAssetNameByPath(meta, p) {
  if (!isRecord(meta.assets)) return undefined;
  for (const [name, asset] of Object.entries(meta.assets)) {
    const versions = isRecord(asset) ? asset.versions : undefined;
    if (Array.isArray(versions) && versions.some((v) => v && v.path === p)) {
      return name;
    }
  }
  return undefined;
}

// Record (or update) a version under an asset. Resolves the asset name from
// action.name, else from action.inheritFrom (an existing version path). If a
// version with the same `path` already exists it is updated in place; otherwise a
// new version is appended with a fresh createdAt. Only supplied fields are written
// (undefined keys are never emitted). Mutates `meta`.
function recordAssetVersion(meta, action) {
  const name =
    typeof action.name === 'string' && action.name
      ? action.name
      : action.inheritFrom
        ? findAssetNameByPath(meta, action.inheritFrom)
        : undefined;
  if (!name) return;
  if (!isRecord(meta.assets)) meta.assets = {};
  const existingAsset = isRecord(meta.assets[name]) ? meta.assets[name] : {};
  const versions = Array.isArray(existingAsset.versions) ? existingAsset.versions : [];
  const status = typeof action.status === 'string' ? action.status : 'needs-review';
  const index = versions.findIndex((v) => v && v.path === action.path);
  if (index >= 0) {
    const version = versions[index];
    version.status = status;
    if (action.subtitle !== undefined) version.subtitle = action.subtitle;
    if (action.viewport !== undefined) {
      const vp = { width: action.viewport.width };
      const height = action.viewport.height ?? version.viewport?.height;
      if (height !== undefined) vp.height = height;
      version.viewport = vp;
    }
    if (action.chatId !== undefined) version.chatId = action.chatId;
    if (action.section !== undefined) version.section = action.section;
  } else {
    // Build in the reference field order, skipping undefined keys.
    const version = { path: action.path, createdAt: nowIso() };
    if (action.chatId !== undefined) version.chatId = action.chatId;
    version.status = status;
    if (action.subtitle !== undefined) version.subtitle = action.subtitle;
    if (action.viewport !== undefined) version.viewport = action.viewport;
    if (action.section !== undefined) version.section = action.section;
    versions.push(version);
  }
  meta.assets[name] = { ...existingAsset, versions };
}

// Remove an asset or version. name & no path → delete the whole asset; path →
// drop matching versions (scoped to name if given) across assets; assets that end
// up empty are deleted, and meta.assets is dropped when it becomes empty.
function unrecordAssetVersion(meta, action) {
  if (!isRecord(meta.assets)) return;
  const name =
    typeof action.name === 'string' && action.name ? action.name : undefined;
  const p =
    typeof action.path === 'string' && action.path ? action.path : undefined;
  if (name && !p) {
    delete meta.assets[name];
  } else if (p) {
    for (const assetName of Object.keys(meta.assets)) {
      if (name && assetName !== name) continue;
      const asset = meta.assets[assetName];
      if (!isRecord(asset) || !Array.isArray(asset.versions)) continue;
      const versions = asset.versions.filter((v) => v && v.path !== p);
      if (versions.length === 0) delete meta.assets[assetName];
      else asset.versions = versions;
    }
  }
  if (Object.keys(meta.assets).length === 0) delete meta.assets;
}

// Read <projectDir>/_d_meta.json. Missing file → {} (fresh project). A file that
// exists but is invalid JSON throws — better than silently clobbering the
// orchestrator-written fields (title/prompt/designSystems/…) on the next write.
function readMeta(metaPath) {
  let raw;
  try {
    raw = fs.readFileSync(metaPath, 'utf8');
  } catch {
    return {};
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`existing _d_meta.json is not valid JSON (${metaPath}): ${(e && e.message) || e}`);
  }
  return isRecord(parsed) ? parsed : {};
}

// Seed the project-level fields when absent, matching the documented no-DS shape
// and the import script. Never invents title/prompt (those are orchestrator-owned).
function bootstrapMeta(meta) {
  if (!meta.type) meta.type = 'design';
  if (!Array.isArray(meta.designSystems)) meta.designSystems = [];
  if (meta.primaryDesignSystem === undefined) meta.primaryDesignSystem = null;
  return meta;
}

// Persist _d_meta.json: set createdAt once, bump updatedAt, pretty-print + newline
// (identical to import-design-system.mjs).
function writeMeta(metaPath, meta) {
  const iso = nowIso();
  if (!meta.createdAt) meta.createdAt = iso;
  meta.updatedAt = iso;
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
}

export {
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
};
