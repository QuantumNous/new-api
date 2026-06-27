#!/usr/bin/env node
// build-preview.mjs — compile a design system directory (one with
// _ds_manifest.json and/or @dsCard-tagged .html cards) into ONE self-contained
// interactive preview.html (no iframes). See
// built-in-skills/design-system-preview.md for the skill doc.
//
// Usage:
//   node <skill>/agents/build-preview.mjs <design-system-dir>
//        [--out <file>] [--title <t>] [--cdn] [--offline]
//
// Cards are isolated with declarative Shadow DOM (one shadow root per card,
// deduped adopted stylesheets) and card scripts run against per-card
// document/window proxies so id lookups, body styles and globals never leak
// between cards. Card previews scale to fit the content column width:
// scale = min(containerWidth/designW, 1), and the card frame shrink-wraps the
// scaled stage so no blank frame shows beside it. The design height is a
// minimum: content that ends up taller grows the card instead of getting
// clipped.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEMPLATE_VIEWPORT = { width: 1280, height: 800 }; // w2
const DEFAULT_VIEWPORT = { width: 728, height: 400 };
const INITIAL_CONTENT_WIDTH = 728; // 760 max-width - 2*16 padding
const MAX_INLINE_ASSET = 3 * 1024 * 1024;
const DEFAULT_REACT_VERSION = "18.3.1";
const DEFAULT_BABEL_VERSION = "7.29.0";
const VENDOR_DIR = path.join(__dirname, "vendor");
const STARTING_POINTS_LABEL = "Starting points";
const TEMPLATES_LABEL = "Templates";

// ---------------------------------------------------------------- utilities

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escAttr(s) {
  return escHtml(s).replace(/"/g, "&quot;");
}
function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function slug(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "x"
  );
}
async function readMaybe(p) {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}
function isRemote(u) {
  return /^(https?:)?\/\//i.test(u);
}
function safeInlineScript(code) {
  return code.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
}

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".json": "application/json",
  ".css": "text/css",
  ".js": "text/javascript",
};

function warn(msg) {
  console.error("  ! " + msg);
}
function info(msg) {
  console.error("  " + msg);
}

// ------------------------------------------------------------------ network

async function fetchText(url, timeoutMs = 30000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function vendorFile(name, url, offline) {
  const p = path.join(VENDOR_DIR, name);
  const cached = await readMaybe(p);
  if (cached != null) return cached;
  if (offline) return null;
  try {
    const text = await fetchText(url);
    await fs.mkdir(VENDOR_DIR, { recursive: true });
    await fs.writeFile(p, text);
    return text;
  } catch (e) {
    warn("fetch failed " + url + " (" + e.message + ")");
    return null;
  }
}

async function loadBuildBabel(offline) {
  try {
    const m = await import("@babel/standalone");
    return m.default && m.default.transform ? m.default : m;
  } catch {}
  // agents/vendor/babel.min.js ships with the skill (the compiler uses it too);
  // fall back to the versioned cache / unpkg download.
  const code =
    (await readMaybe(path.join(VENDOR_DIR, "babel.min.js"))) ??
    (await vendorFile(
      "babel-standalone-" + DEFAULT_BABEL_VERSION + ".min.js",
      "https://unpkg.com/@babel/standalone@" + DEFAULT_BABEL_VERSION + "/babel.min.js",
      offline,
    ));
  if (!code) return null;
  try {
    const sandbox = {};
    const mod = { exports: {} };
    const fn = new Function(
      "module",
      "exports",
      "window",
      "self",
      "globalThis",
      code + "\n;return module.exports;",
    );
    const res = fn(mod, mod.exports, sandbox, sandbox, sandbox);
    const B = sandbox.Babel || res || mod.exports;
    return B && B.transform ? B : null;
  } catch (e) {
    warn("could not evaluate babel-standalone in node: " + e.message);
    return null;
  }
}

// ----------------------------------------------------------------- manifest

function parseViewport(v) {
  if (!v) return undefined;
  if (typeof v !== "string") {
    return v.width && v.height ? { width: +v.width, height: +v.height } : undefined;
  }
  const m = /^(\d+)\s*[xX×]\s*(\d+)$/.exec(v.trim());
  return m ? { width: +m[1], height: +m[2] } : undefined;
}

function fallbackTitle(p) {
  return p.slice(p.lastIndexOf("/") + 1).replace(/\.html$/, "");
}

// Port of buildProjectDesignSystemManifestCardGroups (restored TS).
function buildCardGroups(manifest) {
  const groups = new Map();
  const spPreviewPaths = new Set((manifest?.startingPoints ?? []).map((s) => s.previewPath));
  const seen = new Set();
  const add = (label, card) => {
    const arr = groups.get(label);
    if (arr) arr.push(card);
    else groups.set(label, [card]);
  };
  for (const card of manifest?.cards ?? []) {
    if (!card?.path || spPreviewPaths.has(card.path) || seen.has(card.path)) continue;
    seen.add(card.path);
    add(card.group || "Cards", {
      key: card.path,
      title: card.name || fallbackTitle(card.path),
      path: card.path,
      subtitle: card.subtitle,
      viewport: parseViewport(card.viewport),
    });
  }
  for (const sp of manifest?.startingPoints ?? []) {
    if (!sp?.previewPath) continue;
    add(sp.section || STARTING_POINTS_LABEL, {
      key: "sp:" + (sp.kind || "component") + ":" + sp.name + ":" + sp.path,
      title: sp.name,
      path: sp.previewPath,
      editPath: sp.path,
      subtitle: sp.subtitle,
      viewport: parseViewport(sp.viewport),
    });
  }
  return groups;
}

const DS_CARD_RE = /<!--\s*@dsCard([^>]*?)-->/;
const DIRECTIVE_ATTR_RE = /([a-zA-Z][\w-]*)\s*=\s*"([^"]*)"/g;

function parseDirective(text) {
  const m = DS_CARD_RE.exec(text.slice(0, 600));
  if (!m) return null;
  const out = {};
  let a;
  while ((a = DIRECTIVE_ATTR_RE.exec(m[1]))) out[a[1]] = a[2];
  return out;
}

// Cards may fetch() project files at runtime (icon sprites, sample JSON, …).
// Static markup/CSS refs are inlined elsewhere, but fetch targets are dynamic
// strings, so when any card fetches we inline every small fetchable project
// file and let the card sandbox serve them — preview.html stays self-contained
// even over file:// (where relative fetch would be blocked anyway).
const RUNTIME_ASSET_EXT = /\.(svg|png|jpe?g|gif|webp|avif|ico|json|txt|csv)$/i;
const RUNTIME_ASSET_BUDGET = 3 * 1024 * 1024;

async function collectRuntimeAssets(root, ctx) {
  const skipDirs = new Set(["node_modules", ".git", "_import", "_ds", "_sources", "dist", "build"]);
  const skipFiles = new Set(["package.json", "package-lock.json", "tsconfig.json"]);
  const out = {};
  let total = 0;
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!skipDirs.has(e.name) && !e.name.startsWith(".")) await walk(abs);
        continue;
      }
      if (!RUNTIME_ASSET_EXT.test(e.name)) continue;
      if (e.name.startsWith("_") || e.name.startsWith(".") || skipFiles.has(e.name)) continue;
      const rel = path.relative(root, abs).split(path.sep).join("/");
      const data = await ctx.inlineAsset(abs);
      if (!data) continue;
      if (total + data.length > RUNTIME_ASSET_BUDGET) {
        warn("runtime asset budget reached — not inlining: " + rel);
        continue;
      }
      out[rel] = data;
      total += data.length;
    }
  }
  await walk(root);
  return out;
}

// Fallback when there is no usable manifest: walk the tree for @dsCard files.
async function scanForCards(root) {
  const cards = [];
  const skip = new Set(["node_modules", ".git", "_import", "_ds", "_sources", "dist", "build"]);
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!skip.has(e.name) && !e.name.startsWith(".")) await walk(abs);
        continue;
      }
      if (!/\.html?$/i.test(e.name)) continue;
      const text = await readMaybe(abs);
      if (!text) continue;
      const d = parseDirective(text);
      if (!d) continue;
      const rel = path.relative(root, abs).split(path.sep).join("/");
      cards.push({
        path: rel,
        group: d.group || "Cards",
        name: d.name || fallbackTitle(rel),
        subtitle: d.subtitle,
        viewport: d.viewport,
      });
    }
  }
  await walk(root);
  return cards;
}

// ----------------------------------------------------------------- markdown

function renderInline(text) {
  let s = escHtml(text);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => {
    codes.push(c);
    return " " + (codes.length - 1) + " ";
  });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<img alt="$1" src="$2">');
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(>])\*([^*\n]+)\*(?=$|[\s).,!?:;<])/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  s = s.replace(/ (\d+) /g, (m, i) => "<code>" + codes[+i] + "</code>");
  return s;
}

function renderMarkdown(md) {
  const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
  let html = "";
  let i = 0;
  let para = [];
  const flushPara = () => {
    if (para.length) {
      html += "<p>" + renderInline(para.join(" ")) + "</p>\n";
      para = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      flushPara();
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html +=
        '<pre><code class="lang-' +
        escAttr(fence[1] || "text") +
        '">' +
        escHtml(buf.join("\n")) +
        "</code></pre>\n";
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      const lvl = h[1].length;
      html += "<h" + lvl + ">" + renderInline(h[2].replace(/\s#+\s*$/, "")) + "</h" + lvl + ">\n";
      i++;
      continue;
    }
    if (/^(\s*)([-*_])(\s*\2){2,}\s*$/.test(line)) {
      flushPara();
      html += "<hr>\n";
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      html += "<blockquote>" + renderMarkdown(buf.join("\n")) + "</blockquote>\n";
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flushPara();
      const cells = (l) =>
        l
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(line);
      i += 2;
      let t =
        "<table><thead><tr>" +
        head.map((c) => "<th>" + renderInline(c) + "</th>").join("") +
        "</tr></thead><tbody>";
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        t += "<tr>" + cells(lines[i]).map((c) => "<td>" + renderInline(c) + "</td>").join("") + "</tr>";
        i++;
      }
      html += t + "</tbody></table>\n";
      continue;
    }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flushPara();
      const stack = [];
      const openList = (ordered, indent) => {
        html += ordered ? "<ol>" : "<ul>";
        stack.push({ ordered, indent });
      };
      const closeList = () => {
        const top = stack.pop();
        html += "</li>" + (top.ordered ? "</ol>" : "</ul>");
      };
      let firstItem = true;
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (!m) {
          if (/^\s*$/.test(lines[i]) && i + 1 < lines.length && /^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i + 1])) {
            i++;
            continue;
          }
          if (/^\s{2,}\S/.test(lines[i]) && stack.length) {
            html += " " + renderInline(lines[i].trim());
            i++;
            continue;
          }
          break;
        }
        const indent = m[1].length;
        const ordered = /\d/.test(m[2][0]);
        if (!stack.length) {
          openList(ordered, indent);
          html += "<li>" + renderInline(m[3]);
          firstItem = false;
        } else if (indent > stack[stack.length - 1].indent + 1) {
          openList(ordered, indent);
          html += "<li>" + renderInline(m[3]);
        } else {
          while (stack.length > 1 && indent < stack[stack.length - 1].indent) closeList();
          html += "</li><li>" + renderInline(m[3]);
        }
        i++;
      }
      while (stack.length) closeList();
      html += "\n";
      continue;
    }
    if (/^\s*$/.test(line)) {
      flushPara();
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flushPara();
  return html;
}

// ---------------------------------------------------------------------- css

function findStringEnd(css, i) {
  const q = css[i];
  i++;
  while (i < css.length) {
    if (css[i] === "\\") i += 2;
    else if (css[i] === q) return i + 1;
    else i++;
  }
  return css.length;
}

function findBlockEnd(css, i) {
  let depth = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      i = findStringEnd(css, i);
      continue;
    }
    if (ch === "/" && css[i + 1] === "*") {
      const e = css.indexOf("*/", i + 2);
      i = e === -1 ? css.length : e + 2;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return css.length;
}

function splitCssRules(css) {
  const out = [];
  let i = 0;
  let buf = "";
  while (i < css.length) {
    const ch = css[i];
    if (ch === "/" && css[i + 1] === "*") {
      const e = css.indexOf("*/", i + 2);
      i = e === -1 ? css.length : e + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const e = findStringEnd(css, i);
      buf += css.slice(i, e);
      i = e;
      continue;
    }
    if (ch === "{") {
      const end = findBlockEnd(css, i);
      out.push({ prelude: buf.trim(), body: css.slice(i + 1, end - 1) });
      buf = "";
      i = end;
      continue;
    }
    if (ch === ";") {
      const p = buf.trim();
      if (p) out.push({ prelude: p, body: null });
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const tail = buf.trim();
  if (tail) out.push({ prelude: tail, body: null });
  return out;
}

function scopeSelectors(sel) {
  return sel
    .replace(/:root\b/g, ":host")
    .replace(/(?<![\w.#[\-])html(?![\w\-])/g, ":host")
    .replace(/(?<![\w.#[\-])body(?![\w\-])/g, ".__dsroot");
}

// Rewrites :root/html/body selectors for shadow-DOM scoping and pulls
// @font-face rules out (they are ignored inside shadow roots).
function scopeCss(css, fontSink) {
  let out = "";
  for (const r of splitCssRules(css)) {
    const low = (r.prelude || "").toLowerCase();
    if (r.body == null) {
      if (low.startsWith("@charset") || low.startsWith("@import")) continue;
      out += r.prelude + ";\n";
      continue;
    }
    if (low.startsWith("@font-face")) {
      fontSink.push("@font-face{" + r.body + "}");
      continue;
    }
    if (
      low.startsWith("@media") ||
      low.startsWith("@supports") ||
      low.startsWith("@container") ||
      low.startsWith("@layer") ||
      low.startsWith("@scope")
    ) {
      out += r.prelude + "{" + scopeCss(r.body, fontSink) + "}\n";
      continue;
    }
    if (low.startsWith("@")) {
      out += r.prelude + "{" + r.body + "}\n";
      continue;
    }
    out += scopeSelectors(r.prelude) + "{" + r.body + "}\n";
  }
  return out;
}

function makeAssetInliner(ctx) {
  const cache = new Map();
  return async function inlineAsset(absPath) {
    if (cache.has(absPath)) return cache.get(absPath);
    let result = null;
    try {
      const st = await fs.stat(absPath);
      if (st.size <= MAX_INLINE_ASSET) {
        const buf = await fs.readFile(absPath);
        const mime = MIME[path.extname(absPath).toLowerCase()] || "application/octet-stream";
        result = "data:" + mime + ";base64," + buf.toString("base64");
        ctx.inlinedBytes += buf.length;
      } else {
        warn("asset too large to inline (" + Math.round(st.size / 1024) + "KB): " + path.relative(ctx.root, absPath));
      }
    } catch {
      warn("asset not found: " + path.relative(ctx.root, absPath));
    }
    cache.set(absPath, result);
    return result;
  };
}

function resolveRef(ref, baseDir, root) {
  let clean = ref.trim().replace(/[?#].*$/, "");
  if (!clean || isRemote(clean) || /^[a-z][a-z0-9+.-]*:/i.test(clean)) return null; // data:, javascript:, mailto:, …
  try {
    clean = decodeURIComponent(clean);
  } catch {}
  const abs = clean.startsWith("/") ? path.join(root, clean.slice(1)) : path.resolve(baseDir, clean);
  if (!abs.startsWith(root)) return null;
  return abs;
}

const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

async function rewriteCssUrls(css, baseDir, ctx) {
  const jobs = [];
  css.replace(CSS_URL_RE, (m, q, ref) => {
    jobs.push(ref);
    return m;
  });
  const resolved = new Map();
  for (const ref of jobs) {
    if (resolved.has(ref)) continue;
    const abs = resolveRef(ref, baseDir, ctx.root);
    if (!abs) {
      resolved.set(ref, null);
      continue;
    }
    const data = await ctx.inlineAsset(abs);
    resolved.set(ref, data || path.relative(ctx.root, abs).split(path.sep).join("/"));
  }
  return css.replace(CSS_URL_RE, (m, q, ref) => {
    const r = resolved.get(ref);
    return r ? 'url("' + r + '")' : m;
  });
}

const CSS_IMPORT_RE = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*([^;]*);/g;

async function processCss(cssText, baseDir, ctx, stack = new Set()) {
  let css = cssText.replace(/^﻿/, "");
  const imports = [];
  css.replace(CSS_IMPORT_RE, (m, q1, u1, q2, u2, media) => {
    imports.push({ m, ref: u1 || u2, media: (media || "").trim() });
    return m;
  });
  for (const imp of imports) {
    let replacement = "";
    if (isRemote(imp.ref)) {
      ctx.remoteCss.add(imp.ref);
    } else {
      const abs = resolveRef(imp.ref, baseDir, ctx.root);
      if (abs && !stack.has(abs)) {
        const text = await readMaybe(abs);
        if (text != null) {
          stack.add(abs);
          replacement = await processCss(text, path.dirname(abs), ctx, stack);
          stack.delete(abs);
        } else warn("css import not found: " + imp.ref);
      }
    }
    if (imp.media && replacement) replacement = "@media " + imp.media + "{" + replacement + "}";
    css = css.replace(imp.m, replacement);
  }
  return rewriteCssUrls(css, baseDir, ctx);
}

// --------------------------------------------------------------- card parse

function getAttr(tag, name) {
  const re = new RegExp("\\b" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i");
  const m = re.exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
}

const HTML_PARTS_RE = /<link\b[^>]*\/?>|<style\b[^>]*>[\s\S]*?<\/style>|<script\b[^>]*>[\s\S]*?<\/script>/gi;

function classifyCdnScript(src) {
  const s = src.toLowerCase();
  if (/babel/.test(s)) return "babel";
  if (/react-dom[@./]/.test(s)) return "react-dom";
  if (/\breact[@./]/.test(s)) return "react";
  return null;
}

// Bare string literals like `const PHOTO = "../assets/x.jpg"` (used via src={PHOTO})
// carry no attribute name, so match by shape: relative/rooted path + asset extension.
const STR_REF_RE =
  /(["'])((?:\.{1,2})?\/[^"'\n]*?\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp|mp4|webm|mp3|wav|woff2?|ttf|otf))\1/gi;

async function rewriteScriptStringRefs(code, baseDir, ctx) {
  const refs = [];
  code.replace(STR_REF_RE, (m, q, ref) => {
    refs.push(ref);
    return m;
  });
  const resolved = new Map();
  for (const ref of refs) {
    if (resolved.has(ref)) continue;
    const abs = resolveRef(ref, baseDir, ctx.root);
    // only swap in a successful inline — a miss may be a non-asset string, so keep it verbatim
    resolved.set(ref, abs ? await ctx.inlineAsset(abs) : null);
  }
  return code.replace(STR_REF_RE, (m, q, ref) => {
    const r = resolved.get(ref);
    return r ? q + r + q : m;
  });
}

// script code is re-rooted into the single preview file, so both JSX/markup
// attributes and bare string-literal refs need the same inlining as bodyHtml
async function rewriteScriptAssets(code, baseDir, ctx) {
  const out = await rewriteMarkupAssets(code, baseDir, ctx, { rewriteEvents: false });
  return rewriteScriptStringRefs(out, baseDir, ctx);
}

async function rewriteMarkupAssets(html, baseDir, ctx, { rewriteEvents = true } = {}) {
  const ATTR_RE = /\b(src|poster|href)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  const refs = [];
  html.replace(ATTR_RE, (m, attr, q, v1, v2) => {
    refs.push({ attr: attr.toLowerCase(), ref: v1 ?? v2 });
    return m;
  });
  const resolved = new Map();
  for (const { attr, ref } of refs) {
    if (resolved.has(ref)) continue;
    const abs = resolveRef(ref, baseDir, ctx.root);
    if (!abs) {
      resolved.set(ref, null);
      continue;
    }
    if (attr === "href") {
      resolved.set(ref, path.relative(ctx.root, abs).split(path.sep).join("/"));
    } else {
      const data = await ctx.inlineAsset(abs);
      resolved.set(ref, data || path.relative(ctx.root, abs).split(path.sep).join("/"));
    }
  }
  let out = html.replace(ATTR_RE, (m, attr, q, v1, v2) => {
    const r = resolved.get(v1 ?? v2);
    return r ? attr + '="' + escAttr(r) + '"' : m;
  });
  // srcset: rewrite each candidate URL
  out = await (async () => {
    const SRCSET_RE = /\bsrcset\s*=\s*("([^"]*)"|'([^']*)')/gi;
    const jobs = [];
    out.replace(SRCSET_RE, (m, q, v1, v2) => {
      jobs.push(v1 ?? v2);
      return m;
    });
    const map = new Map();
    for (const set of jobs) {
      const parts = await Promise.all(
        set.split(",").map(async (entry) => {
          const [u, ...desc] = entry.trim().split(/\s+/);
          const abs = resolveRef(u, baseDir, ctx.root);
          if (!abs) return entry.trim();
          const data = await ctx.inlineAsset(abs);
          return [data || u, ...desc].join(" ");
        }),
      );
      map.set(set, parts.join(", "));
    }
    return out.replace(SRCSET_RE, (m, q, v1, v2) => 'srcset="' + escAttr(map.get(v1 ?? v2) ?? (v1 ?? v2)) + '"');
  })();
  // inline event handlers -> data attributes (run inside the card sandbox)
  if (rewriteEvents)
    out = out.replace(/\son([a-z]+)\s*=\s*("([^"]*)"|'([^']*)')/gi, (m, evt, q, v1, v2) => {
      return " data-ds-on" + evt + '="' + escAttr(v1 ?? v2 ?? "") + '"';
    });
  return out;
}

async function parseCardHtml(absPath, ctx) {
  const raw = await readMaybe(absPath);
  if (raw == null) return null;
  const dir = path.dirname(absPath);
  const text = raw.replace(DS_CARD_RE, "");

  const card = {
    cssTexts: [], // ordered css chunks (already scoped later)
    scripts: [], // {code, babel, name}
    remoteLinks: [],
    needsReact: false,
    usesBundle: false,
    bodyClass: "",
    bodyStyle: "",
    bodyHtml: "",
  };

  const matches = [...text.matchAll(HTML_PARTS_RE)];
  for (const m of matches) {
    const tag = m[0];
    const open = tag.slice(0, tag.indexOf(">") + 1);
    if (/^<link/i.test(tag)) {
      const rel = (getAttr(open, "rel") || "").toLowerCase();
      if (!rel.includes("stylesheet")) continue;
      const href = getAttr(open, "href");
      if (!href) continue;
      if (isRemote(href)) {
        ctx.remoteCss.add(href);
        card.remoteLinks.push(href);
        continue;
      }
      const abs = resolveRef(href, dir, ctx.root);
      const css = abs ? await readMaybe(abs) : null;
      if (css == null) {
        warn("stylesheet not found: " + href + " (" + path.relative(ctx.root, absPath) + ")");
        continue;
      }
      card.cssTexts.push(await processCss(css, path.dirname(abs), ctx));
      continue;
    }
    if (/^<style/i.test(tag)) {
      const inner = tag.replace(/^<style\b[^>]*>/i, "").replace(/<\/style>$/i, "");
      card.cssTexts.push(await processCss(inner, dir, ctx));
      continue;
    }
    // <script>
    const src = getAttr(open, "src");
    const type = (getAttr(open, "type") || "").toLowerCase();
    const isBabel = type.includes("babel") || type.includes("jsx");
    if (src) {
      if (isRemote(src)) {
        const kind = classifyCdnScript(src);
        if (kind === "react" || kind === "react-dom") {
          card.needsReact = true;
          const vm = /@(\d+\.\d+\.\d+)/.exec(src);
          if (vm) ctx.reactVersion = vm[1];
          continue;
        }
        if (kind === "babel") continue; // JSX handled at build time
        ctx.remoteScripts.add(src);
        continue;
      }
      const abs = resolveRef(src, dir, ctx.root);
      if (!abs) continue;
      if (path.basename(abs) === "_ds_bundle.js") {
        card.usesBundle = true;
        ctx.bundlePath = abs;
        continue;
      }
      const code = await readMaybe(abs);
      if (code == null) {
        warn("script not found: " + src);
        continue;
      }
      card.scripts.push({
        code: await rewriteScriptAssets(code, path.dirname(abs), ctx),
        babel: isBabel,
        name: path.basename(abs),
      });
      continue;
    }
    const inner = tag.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "");
    if (!inner.trim()) continue;
    if (type && !isBabel && type !== "text/javascript" && type !== "module" && type !== "application/javascript")
      continue; // json templates etc.
    card.scripts.push({
      code: await rewriteScriptAssets(inner, dir, ctx),
      babel: isBabel,
      name: null,
    });
  }

  const bodyM = /<body([^>]*)>([\s\S]*?)<\/body>/i.exec(text);
  let bodyInner;
  if (bodyM) {
    card.bodyClass = getAttr("<body" + bodyM[1] + ">", "class") || "";
    card.bodyStyle = getAttr("<body" + bodyM[1] + ">", "style") || "";
    bodyInner = bodyM[2];
  } else {
    bodyInner = text
      .replace(/<!doctype[^>]*>/i, "")
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, "")
      .replace(/<\/?html[^>]*>/gi, "");
  }
  bodyInner = bodyInner.replace(HTML_PARTS_RE, "");
  card.bodyHtml = (await rewriteMarkupAssets(bodyInner, dir, ctx)).trim();
  if (card.scripts.some((s) => s.babel)) card.needsReact = true;
  return card;
}

// ------------------------------------------------------------------- chrome

const HOST_CSS = String.raw`
:root {
  color-scheme: light;
  --ds-bg: #FAF9F5;
  --ds-surface: #FFFFFF;
  --ds-text: rgba(15, 12, 8, 0.92);
  --ds-text-2: rgba(15, 12, 8, 0.62);
  --ds-text-3: rgba(15, 12, 8, 0.46);
  --ds-border: rgba(15, 12, 8, 0.10);
  --ds-border-soft: rgba(15, 12, 8, 0.07);
  --ds-hover: rgba(15, 12, 8, 0.045);
  --ds-active: rgba(15, 12, 8, 0.07);
  --ds-accent: #D97757;
  --ds-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --ds-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  font-family: var(--ds-font);
  background: var(--ds-bg);
  color: var(--ds-text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }

.ds-pane { display: flex; height: 100vh; height: 100dvh; overflow: hidden; }

/* ------------------------------------------------- outline (left nav) */
.ds-outline {
  flex: 0 0 248px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--ds-border-soft);
  background: var(--ds-bg);
}
@media (max-width: 1007px) { .ds-outline { display: none; } }
.ds-outline-head { padding: 18px 16px 12px; }
.ds-outline-head h1 { margin: 0; font-size: 18px; font-weight: 550; letter-spacing: -0.01em; color: var(--ds-text); }
.ds-outline-scroll { flex: 1; overflow-y: auto; padding: 4px 8px 16px; scrollbar-width: thin; }
.ds-pinned { margin: 0 0 4px; padding: 0 0 6px; border-bottom: 1px solid var(--ds-border-soft); }
.ds-item {
  display: flex; align-items: center; width: 100%;
  text-align: left; padding: 5px 8px 5px 24px;
  font-size: 12px; line-height: 1.35; color: var(--ds-text-2);
  border-radius: 6px;
}
.ds-item:hover { background: var(--ds-hover); color: var(--ds-text); }
.ds-item.active { font-weight: 550; color: var(--ds-text); background: var(--ds-active); }
.ds-item .ds-ic { flex: 0 0 auto; width: 13px; height: 13px; margin-left: -19px; margin-right: 6px; opacity: 0.75; }
.ds-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-group-btn {
  display: flex; align-items: center; gap: 5px; width: 100%;
  padding: 6px 8px; margin-top: 6px;
  font-size: 12px; font-weight: 550; color: var(--ds-text-2);
  border-radius: 6px;
}
.ds-group-btn:hover { background: var(--ds-hover); color: var(--ds-text); }
.ds-group-btn .ds-caret { width: 9px; height: 9px; flex: 0 0 auto; transition: transform 0.15s ease; opacity: 0.7; }
.ds-outline-group.collapsed .ds-caret { transform: rotate(-90deg); }
.ds-outline-group.collapsed .ds-group-items { display: none; }
.ds-group-btn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ------------------------------------------------------- content column */
.ds-content { flex: 1 1 auto; min-width: 0; overflow-y: auto; overscroll-behavior: contain; }
.ds-content-inner {
  display: flex; flex-direction: column; gap: 24px;
  padding: 30px 16px 80px;
  max-width: 760px; margin: 0 auto;
}
.ds-group-label { margin: 6px 0 14px; font-size: 13px; font-weight: 550; color: var(--ds-text); }
.ds-card + .ds-card { margin-top: 26px; }
.ds-card-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
.ds-card-title { margin: 0; font-size: 13.5px; font-weight: 550; line-height: 1.3; color: var(--ds-text); }
.ds-card-sub { margin: 2px 0 0; font-size: 12px; line-height: 1.45; color: var(--ds-text-3); }
.ds-prevwrap {
  position: relative; overflow: hidden;
  border: 1px solid var(--ds-border-soft); border-radius: 8px;
  background: #fff;
}
/* Outer-tree color-scheme on the shadow host beats the card's own
   ':host { color-scheme: light dark }' (rewritten from ':root'), so
   light-dark() tokens resolve LIGHT regardless of the viewer's OS theme —
   the preview chrome is light-only. Cards opting into dark explicitly
   (e.g. a '.spectrum-dark' subtree) still render dark. */
.ds-stage { transform-origin: top left; visibility: hidden; color-scheme: light; }
.ds-stage[data-ready] { visibility: visible; }

/* ------------------------------------------------------------- readme */
.ds-readme-body { position: relative; }
.ds-readme-body.collapsed { max-height: 280px; overflow: hidden; }
.ds-readme-body.collapsed::after {
  content: ""; position: absolute; inset: auto 0 0 0; height: 64px;
  background: linear-gradient(to bottom, rgba(250, 249, 245, 0), var(--ds-bg));
  pointer-events: none;
}
.ds-readme-toggle { margin-top: 8px; font-size: 12px; font-weight: 500; color: var(--ds-text-2); }
.ds-readme-toggle:hover { color: var(--ds-text); }

/* -------------------------------------------------------------- prose */
.ds-prose { font-size: 13px; line-height: 1.6; color: var(--ds-text); }
.ds-prose > :first-child { margin-top: 0; }
.ds-prose h1 { font-size: 19px; font-weight: 600; margin: 22px 0 8px; letter-spacing: -0.01em; }
.ds-prose h2 { font-size: 16px; font-weight: 600; margin: 20px 0 6px; }
.ds-prose h3 { font-size: 13.5px; font-weight: 600; margin: 16px 0 4px; }
.ds-prose h4, .ds-prose h5, .ds-prose h6 { font-size: 12.5px; font-weight: 600; margin: 14px 0 4px; }
.ds-prose p { margin: 0 0 10px; }
.ds-prose ul, .ds-prose ol { margin: 0 0 10px; padding-left: 22px; }
.ds-prose li { margin: 2px 0; }
.ds-prose code {
  font-family: var(--ds-mono); font-size: 0.92em;
  background: rgba(15, 12, 8, 0.055); border-radius: 4px; padding: 0.1em 0.35em;
}
.ds-prose pre {
  background: rgba(15, 12, 8, 0.045); border: 1px solid var(--ds-border-soft);
  border-radius: 8px; padding: 12px 14px; overflow-x: auto; margin: 0 0 12px;
}
.ds-prose pre code { background: none; padding: 0; font-size: 11.5px; line-height: 1.55; }
.ds-prose blockquote {
  margin: 0 0 10px; padding: 2px 0 2px 12px;
  border-left: 3px solid rgba(15, 12, 8, 0.14); color: var(--ds-text-2);
}
.ds-prose hr { border: 0; border-top: 1px solid var(--ds-border-soft); margin: 16px 0; }
.ds-prose table { border-collapse: collapse; margin: 0 0 12px; font-size: 12px; width: 100%; }
.ds-prose th, .ds-prose td { border: 1px solid var(--ds-border); padding: 5px 9px; text-align: left; vertical-align: top; }
.ds-prose th { background: rgba(15, 12, 8, 0.035); font-weight: 600; }
.ds-prose img { max-width: 100%; border-radius: 6px; }
.ds-prose a { color: inherit; text-decoration: underline; text-decoration-color: rgba(15, 12, 8, 0.3); }
.ds-prose a:hover { text-decoration-color: currentColor; }

.ds-empty { font-size: 13px; color: var(--ds-text-3); padding: 24px 0; }
`;

const ICONS = {
  caret:
    '<svg class="ds-caret" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 3.25 5 6.75l3.5-3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  book:
    '<svg class="ds-ic" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 3.2c0-.66.54-1.2 1.2-1.2h8.6c.66 0 1.2.54 1.2 1.2v9.6c0 .66-.54 1.2-1.2 1.2H3.7a1.2 1.2 0 0 1-1.2-1.2V3.2Z" stroke="currentColor" stroke-width="1.2"/><path d="M5.4 2v12" stroke="currentColor" stroke-width="1.2"/></svg>',
};

// ------------------------------------------------------------- runtime (js)
// NOTE: no backticks / template substitutions inside this string.

const RUNTIME_JS = String.raw`(function () {
  var dataEl = document.getElementById("ds-data");
  if (!dataEl) return;
  var DATA = JSON.parse(dataEl.textContent);
  var ASSETS = DATA.assets || {};
  var cardById = {};
  DATA.cards.forEach(function (c) { cardById[c.id] = c; });

  function normPath(p) {
    var segs = p.split("/");
    var out = [];
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (!s || s === ".") continue;
      if (s === "..") { if (out.length) out.pop(); continue; }
      out.push(s);
    }
    return out.join("/");
  }

  var supportsAdopt = (function () {
    try {
      var s = new CSSStyleSheet();
      s.replaceSync(":host{}");
      return "adoptedStyleSheets" in Document.prototype || "adoptedStyleSheets" in ShadowRoot.prototype;
    } catch (e) { return false; }
  })();

  var sheetCache = {};
  function getSheet(hash) {
    if (!sheetCache[hash]) {
      var s = new CSSStyleSheet();
      try { s.replaceSync(DATA.css[hash] || ""); } catch (e) { console.error("[ds-preview] css error", e); }
      sheetCache[hash] = s;
    }
    return sheetCache[hash];
  }

  // Cards scroll if their content overflows the declared viewport, but the
  // scrollbar chrome itself reads as a defect in a scaled-down thumbnail —
  // hide it (content stays scrollable). Applied last so it wins ties.
  var BASE_CARD_CSS = ".__dsroot{scrollbar-width:none;-ms-overflow-style:none}.__dsroot::-webkit-scrollbar{display:none}";
  var baseCardSheet = null;
  function getBaseCardSheet() {
    if (!baseCardSheet) {
      baseCardSheet = new CSSStyleSheet();
      try { baseCardSheet.replaceSync(BASE_CARD_CSS); } catch (e) {}
    }
    return baseCardSheet;
  }

  function ensureShadow(stage) {
    var root = stage.shadowRoot;
    if (!root) {
      var tpl = stage.querySelector("template");
      root = stage.attachShadow({ mode: "open" });
      if (tpl) { root.appendChild(tpl.content); tpl.remove(); }
    }
    return root;
  }

  function applyStyles(root, hashes) {
    if (supportsAdopt && root.adoptedStyleSheets !== undefined) {
      try { root.adoptedStyleSheets = hashes.map(getSheet).concat([getBaseCardSheet()]); return; } catch (e) {}
    }
    var base = document.createElement("style");
    base.textContent = BASE_CARD_CSS;
    root.insertBefore(base, root.firstChild);
    for (var i = hashes.length - 1; i >= 0; i--) {
      var st = document.createElement("style");
      st.textContent = DATA.css[hashes[i]] || "";
      root.insertBefore(st, root.firstChild);
    }
  }

  function appendExports(code) {
    var names = {};
    var re = /^(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)|^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/gm;
    var m;
    while ((m = re.exec(code))) names[m[1] || m[2]] = 1;
    var tail = Object.keys(names).map(function (n) {
      return "try{__vars." + n + "=" + n + ";}catch(__e){}";
    }).join("");
    return tail ? code + "\n;" + tail : code;
  }

  function makeEnv(card, root, rootEl) {
    var vars = Object.create(null);
    var pendingLoad = [];
    var realDoc = document;
    var realWin = window;
    var winProxy, docProxy;

    // Card sources live in subdirectories, but their HTML is re-rooted into
    // this single file — rebase relative fetch() URLs against the card's
    // source dir, serving build-time-inlined project assets when available
    // (which also makes them work over file://).
    vars.fetch = function (input, init) {
      var u = null;
      try { u = typeof input === "string" ? input : null; } catch (e) {}
      if (u != null && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u) && u.charAt(0) !== "/" && u.charAt(0) !== "#" && u.charAt(0) !== "?") {
        var m = /^([^?#]*)([\s\S]*)$/.exec(u);
        var resolved = normPath((card.base ? card.base + "/" : "") + m[1]);
        if (Object.prototype.hasOwnProperty.call(ASSETS, resolved)) return realWin.fetch(ASSETS[resolved], init);
        return realWin.fetch(resolved + m[2], init);
      }
      return realWin.fetch(input, init);
    };

    docProxy = new Proxy(realDoc, {
      get: function (t, k) {
        switch (k) {
          case "getElementById":
            return function (id) {
              return root.getElementById ? root.getElementById(id) : root.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(id) : id));
            };
          case "querySelector": return root.querySelector.bind(root);
          case "querySelectorAll": return root.querySelectorAll.bind(root);
          case "getElementsByClassName": return function (c) { return rootEl.getElementsByClassName(c); };
          case "getElementsByTagName": return function (s) { return rootEl.getElementsByTagName(s); };
          case "body": case "documentElement": case "head": return rootEl;
          case "defaultView": return winProxy;
          case "readyState": return "complete";
          case "currentScript": return null;
          case "activeElement": return root.activeElement || null;
          case "styleSheets": return root.styleSheets;
          case "location": return realWin.location;
          case "addEventListener":
            return function (type, fn, o) {
              if (type === "DOMContentLoaded" || type === "load" || type === "readystatechange") pendingLoad.push(fn);
              else realDoc.addEventListener(type, fn, o);
            };
          case "removeEventListener": return realDoc.removeEventListener.bind(realDoc);
          default: {
            var v = t[k];
            return typeof v === "function" ? v.bind(t) : v;
          }
        }
      },
      set: function (t, k, val) {
        if (k === "title" || k === "cookie") return true;
        try { t[k] = val; } catch (e) {}
        return true;
      },
    });

    winProxy = new Proxy(realWin, {
      get: function (t, k) {
        switch (k) {
          case "document": return docProxy;
          case "window": case "self": case "globalThis": case "top": case "parent": case "frames": return winProxy;
          case "innerWidth": return card.w;
          case "innerHeight": return card.h;
          case "addEventListener":
            return function (type, fn, o) {
              if (type === "load" || type === "DOMContentLoaded") pendingLoad.push(fn);
              else t.addEventListener(type, fn, o);
            };
          case "removeEventListener": return t.removeEventListener.bind(t);
          default:
            if (k in vars) return vars[k];
            var v = t[k];
            if (typeof v === "function" && typeof k === "string" && /^[a-z]/.test(k)) {
              try { return v.bind(t); } catch (e) { return v; }
            }
            return v;
        }
      },
      set: function (t, k, val) {
        if (k === "onload") { pendingLoad.push(val); return true; }
        vars[k] = val;
        return true;
      },
      has: function (t, k) { return k in vars || k in t; },
    });

    var scope = new Proxy(vars, {
      has: function (t, k) {
        if (typeof k !== "string") return false;
        if (k === "window" || k === "document" || k === "globalThis" || k === "self" || k === "__vars" || k === "__scope" || k === "event") return false;
        return k in t;
      },
      get: function (t, k) { return t[k]; },
      set: function (t, k, v) { t[k] = v; return true; },
    });

    return { win: winProxy, doc: docProxy, vars: vars, scope: scope, pendingLoad: pendingLoad };
  }

  function runCode(card, env, code, name) {
    var body = "with(__scope){\n" + appendExports(code) + "\n}";
    try {
      var fn = new Function("window", "document", "globalThis", "self", "__vars", "__scope", body);
      fn.call(env.win, env.win, env.doc, env.win, env.win, env.vars, env.scope);
    } catch (err) {
      console.error("[ds-preview] " + card.id + (name ? " (" + name + ")" : "") + ":", err);
    }
  }

  function runScripts(card, env) {
    for (var i = 0; i < card.js.length; i++) {
      var s = card.js[i];
      var code = s.code;
      if (s.babel) {
        if (window.Babel) {
          try {
            code = Babel.transform(code, { presets: [["react", {}]], filename: s.name || "card.jsx" }).code;
          } catch (err) {
            console.error("[ds-preview] babel " + card.id + ":", err);
            continue;
          }
        } else {
          console.error("[ds-preview] " + card.id + " needs Babel but it is not loaded");
          continue;
        }
      }
      runCode(card, env, code, s.name);
    }
    var flush = env.pendingLoad.splice(0);
    if (flush.length) {
      setTimeout(function () {
        var ev; try { ev = new Event("load"); } catch (e) { ev = { type: "load" }; }
        flush.forEach(function (fn) {
          try { typeof fn === "function" && fn.call(env.win, ev); } catch (err) { console.error("[ds-preview]", err); }
        });
      }, 0);
    }
  }

  function bindInlineHandlers(card, env, rootEl) {
    var all = rootEl.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      for (var j = 0; j < el.attributes.length; j++) {
        var at = el.attributes[j];
        if (at.name.indexOf("data-ds-on") !== 0) continue;
        (function (el, evt, code) {
          el.addEventListener(evt, function (event) {
            try {
              var fn = new Function("window", "document", "globalThis", "self", "__scope", "event", "with(__scope){\n" + code + "\n}");
              fn.call(el, env.win, env.doc, env.win, env.win, env.scope, event);
            } catch (err) { console.error("[ds-preview] inline handler:", err); }
          });
        })(el, at.name.slice(10), at.value);
      }
    }
  }

  function fit(section) {
    var card = cardById[section.id];
    var wrap = section.querySelector("[data-fit]");
    var stage = section.querySelector("[data-stage]");
    if (!card || !wrap || !stage) return;
    // Measure the available width on the SECTION, not the wrap: the wrap is
    // shrink-wrapped to the scaled stage below, so reading it back would feed
    // the previous scale into the next one.
    var cw = section.clientWidth || wrap.clientWidth;
    if (!cw) return;
    // The declared viewport height is a MINIMUM: content that ends up taller
    // (React mounts, fetched icons, wrapped rows) grows the stage instead of
    // getting clipped. Monotonic with a 1px tolerance so repeated measures
    // never jitter the layout back down.
    var rootEl = stage.shadowRoot && stage.shadowRoot.querySelector(".__dsroot");
    if (rootEl) {
      // Cap growth so content sized relative to the container (height:100%
      // plus a fixed extra) can never ratchet the stage upward forever.
      var contentH = Math.min(rootEl.scrollHeight, Math.max(card.h, 4000));
      if (contentH > (card.eh || card.h) + 1) card.eh = contentH;
    }
    var h = Math.max(card.eh || 0, card.h);
    stage.style.height = h + "px";
    // Width-only scaling: height never shrinks the card (it would leave blank
    // bands beside the narrower stage). The wrap shrink-wraps the scaled stage
    // so its frame always hugs the visible pixels.
    var scale = Math.min(cw / card.w, 1);
    stage.style.transform = scale === 1 ? "none" : "scale(" + scale + ")";
    wrap.style.width = Math.ceil(card.w * scale) + "px";
    wrap.style.height = Math.ceil(h * scale) + "px";
  }

  var sections = [].slice.call(document.querySelectorAll("[data-card]"));
  function fitAll() { sections.forEach(fit); }

  // ---- mount all cards
  sections.forEach(function (section) {
    var card = cardById[section.id];
    if (!card) return;
    var stage = section.querySelector("[data-stage]");
    try {
      var root = ensureShadow(stage);
      var rootEl = root.querySelector(".__dsroot");
      applyStyles(root, card.css);
      var env = makeEnv(card, root, rootEl);
      if (card.js.length) runScripts(card, env);
      bindInlineHandlers(card, env, rootEl);
      // Card content keeps changing after mount (React commits async, icon
      // fetches resolve, images decode) — re-measure on every DOM change and
      // resource load inside the shadow tree.
      if (window.MutationObserver) {
        new MutationObserver(function () { fit(section); }).observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
      }
      root.addEventListener("load", function () { fit(section); }, true);
    } catch (err) {
      console.error("[ds-preview] mount " + card.id + ":", err);
    }
    stage.setAttribute("data-ready", "1");
    fit(section);
  });

  // ---- scaling
  var scroller = document.querySelector("[data-scroll]");
  var inner = document.querySelector(".ds-content-inner");
  if (window.ResizeObserver && inner) {
    var raf = 0;
    new ResizeObserver(function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fitAll);
    }).observe(inner);
  } else {
    window.addEventListener("resize", fitAll);
  }
  // Web fonts swap and late resources settle without DOM mutations —
  // re-measure once fonts are ready plus a few fallback ticks.
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(function () { fitAll(); });
  }
  [250, 750, 1500, 3000].forEach(function (ms) { setTimeout(fitAll, ms); });

  // ---- outline interactions
  var items = [].slice.call(document.querySelectorAll(".ds-item[data-target]"));
  var itemByTarget = {};
  items.forEach(function (it) { itemByTarget[it.getAttribute("data-target")] = it; });
  var anchors = [].slice.call(document.querySelectorAll("[data-anchor]"));
  var suppressUntil = 0;

  function setActive(it) {
    items.forEach(function (x) { x.classList.toggle("active", x === it); });
    if (it) {
      var g = it.closest(".ds-outline-group");
      if (g) g.classList.remove("collapsed");
    }
  }

  items.forEach(function (it) {
    it.addEventListener("click", function () {
      var target = document.getElementById(it.getAttribute("data-target"));
      if (!target || !scroller) return;
      var top = scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 20;
      suppressUntil = Date.now() + 900;
      setActive(it);
      scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
  });

  [].slice.call(document.querySelectorAll("[data-group-toggle]")).forEach(function (btn) {
    btn.addEventListener("click", function () {
      btn.closest(".ds-outline-group").classList.toggle("collapsed");
    });
  });

  function spy() {
    if (Date.now() < suppressUntil || !scroller) return;
    var cTop = scroller.getBoundingClientRect().top;
    var best = null;
    for (var i = 0; i < anchors.length; i++) {
      var r = anchors[i].getBoundingClientRect();
      if (r.top - cTop <= 90) best = anchors[i];
      else break;
    }
    if (!best && anchors.length) best = anchors[0];
    if (best) {
      var key = best.getAttribute("data-anchor-key") || best.id;
      setActive(itemByTarget[key] || itemByTarget[best.id] || null);
    }
  }
  if (scroller) {
    var sraf = 0;
    scroller.addEventListener("scroll", function () {
      cancelAnimationFrame(sraf);
      sraf = requestAnimationFrame(spy);
    }, { passive: true });
    spy();
  }

  // ---- readme collapse
  var readme = document.querySelector("[data-readme]");
  var toggle = document.querySelector("[data-readme-toggle]");
  if (readme && toggle) {
    var update = function () {
      var collapsed = readme.classList.contains("collapsed");
      toggle.textContent = collapsed ? "Show more" : "Show less";
    };
    if (readme.scrollHeight <= 300) {
      readme.classList.remove("collapsed");
      toggle.style.display = "none";
    }
    toggle.addEventListener("click", function () {
      readme.classList.toggle("collapsed");
      update();
      fitAll();
    });
    update();
  }

  window.addEventListener("load", fitAll);
})();
`;

// -------------------------------------------------------------- html pieces

function buildOutlineHtml(outlineGroups, pinnedReadme, keyToId) {
  let items = "";
  if (pinnedReadme) {
    items +=
      '<div class="ds-pinned"><button class="ds-item" data-target="ds-readme">' +
      ICONS.book +
      "<span>Readme</span></button></div>";
  }
  for (const g of outlineGroups) {
    items += '<div class="ds-outline-group">';
    items +=
      '<button class="ds-group-btn" data-group-toggle>' +
      ICONS.caret +
      "<span>" +
      escHtml(g.label) +
      "</span></button>";
    items += '<div class="ds-group-items">';
    for (let i = 0; i < g.items.length; i++) {
      const it = g.items[i];
      // First item of a section scrolls to the section header, like the original.
      const target = i === 0 ? g.domId : keyToId.get(it.key);
      items +=
        '<button class="ds-item" data-target="' +
        escAttr(target) +
        '"><span>' +
        escHtml(it.label) +
        "</span></button>";
    }
    items += "</div></div>";
  }
  return (
    '<nav class="ds-outline" aria-label="Design system outline">' +
    '<div class="ds-outline-head"><h1>Design system</h1></div>' +
    '<div class="ds-outline-scroll">' +
    items +
    "</div></nav>"
  );
}

function buildReadmeHtml(readmeHtml) {
  return (
    '<section class="ds-card" id="ds-readme" data-anchor data-anchor-key="ds-readme">' +
    '<header class="ds-card-head"><h3 class="ds-card-title">Readme</h3></header>' +
    '<div class="ds-readme-body ds-prose collapsed" data-readme>' +
    readmeHtml +
    "</div>" +
    '<button class="ds-readme-toggle" data-readme-toggle type="button">Show more</button>' +
    "</section>"
  );
}

function buildCardSectionHtml(entry, cid, parsed, viewport, initialScale, anchorKey) {
  const w = viewport.width;
  const h = viewport.height;
  const stageStyle =
    "width:" +
    w +
    "px;height:" +
    h +
    "px;" +
    (initialScale < 1 ? "transform:scale(" + initialScale + ");" : "");
  // The wrap shrink-wraps the scaled stage (no blank frame beside narrow
  // cards). content-box: the host sheet sets border-box globally, and the
  // wrap's 1px borders must not eat into the stage box.
  const wrapStyle =
    "box-sizing:content-box;width:" +
    Math.ceil(w * initialScale) +
    "px;height:" +
    Math.ceil(h * initialScale) +
    "px;";
  const rootAttrs =
    ' class="__dsroot' +
    (parsed.bodyClass ? " " + escAttr(parsed.bodyClass) : "") +
    '"' +
    // border-box keeps the root's box equal to the stage even when the card
    // body declares padding (like a real viewport: padding goes inside) —
    // otherwise scrollHeight always exceeds the stage and auto-grow loops.
    ' style="margin:0;width:100%;height:100%;overflow:auto;box-sizing:border-box;' +
    (parsed.bodyStyle ? escAttr(parsed.bodyStyle) : "") +
    '"';
  const remoteLinkTags = parsed.remoteLinks
    .map((href) => '<link rel="stylesheet" href="' + escAttr(href) + '">')
    .join("");
  return (
    '<section class="ds-card" id="' +
    cid +
    '" data-card data-anchor data-anchor-key="' +
    escAttr(anchorKey || cid) +
    '">' +
    '<header class="ds-card-head"><div>' +
    '<h3 class="ds-card-title">' +
    escHtml(entry.title) +
    "</h3>" +
    (entry.subtitle ? '<p class="ds-card-sub">' + escHtml(entry.subtitle) + "</p>" : "") +
    "</div></header>" +
    '<div class="ds-prevwrap" data-fit style="' +
    wrapStyle +
    '">' +
    '<div class="ds-stage" data-stage style="' +
    stageStyle +
    '">' +
    '<template shadowrootmode="open">' +
    remoteLinkTags +
    "<div" +
    rootAttrs +
    ">" +
    parsed.bodyHtml +
    "</div></template></div></div></section>"
  );
}

// --------------------------------------------------------------------- main

function parseCliArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" || a === "--title") args[a.slice(2)] = argv[++i];
    else if (a === "--cdn") args.cdn = true;
    else if (a === "--offline") args.offline = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else args._.push(a);
  }
  return args;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || !args._[0]) {
    console.error(
      "Usage: node build-preview.mjs <design-system-dir> [--out file] [--title t] [--cdn] [--offline]",
    );
    process.exit(args.help ? 0 : 1);
  }
  const root = path.resolve(args._[0]);
  const st = await fs.stat(root).catch(() => null);
  if (!st?.isDirectory()) {
    console.error("Not a directory: " + root);
    process.exit(1);
  }
  const outPath = args.out ? path.resolve(args.out) : path.join(root, "preview.html");
  const title = args.title || path.basename(root);

  console.error("Building preview for " + root);

  const ctx = {
    root,
    remoteCss: new Set(),
    remoteScripts: new Set(),
    reactVersion: null,
    bundlePath: null,
    inlinedBytes: 0,
  };
  ctx.inlineAsset = makeAssetInliner(ctx);

  // ---- manifest / cards
  let manifest = null;
  const manifestText = await readMaybe(path.join(root, "_ds_manifest.json"));
  if (manifestText) {
    try {
      manifest = JSON.parse(manifestText);
    } catch (e) {
      warn("invalid _ds_manifest.json: " + e.message);
    }
  }
  if (!manifest || (!manifest.cards?.length && !manifest.startingPoints?.length && !manifest.templates?.length)) {
    info(manifest
      ? "manifest has no cards, starting points, or templates — scanning for @dsCard files…"
      : "no manifest (run compile-design-system.mjs to generate one) — scanning for @dsCard files…");
    manifest = { cards: await scanForCards(root) };
  }

  const cardGroups = buildCardGroups(manifest);
  const templates = (manifest.templates ?? []).filter((t) => t?.entryPath);

  // outline groups: Templates first, then card groups (insertion order)
  const outlineGroups = [];
  if (templates.length) {
    outlineGroups.push({
      domId: "g-templates",
      label: TEMPLATES_LABEL,
      items: templates.map((t) => ({
        key: "tpl:" + t.entryPath,
        label: t.name || fallbackTitle(t.entryPath),
      })),
    });
  }
  for (const [label, cards] of cardGroups) {
    outlineGroups.push({
      domId: "g-" + slug(label),
      label,
      items: cards.map((c) => ({ key: c.key, label: c.title })),
    });
  }

  // ---- flatten card entries in content order
  const entries = [];
  for (const t of templates) {
    entries.push({
      key: "tpl:" + t.entryPath,
      title: t.name || fallbackTitle(t.entryPath),
      subtitle: t.description,
      path: t.entryPath,
      group: TEMPLATES_LABEL,
      groupId: "g-templates",
      viewport: parseViewport(t.viewport) || TEMPLATE_VIEWPORT,
    });
  }
  for (const [label, cards] of cardGroups) {
    for (const c of cards) {
      entries.push({ ...c, group: label, groupId: "g-" + slug(label) });
    }
  }

  if (!entries.length) {
    warn('no cards found — add <!-- @dsCard group="…" --> as the first line of .html files');
  }

  // ---- parse each unique card file once
  const parsedByPath = new Map();
  for (const e of entries) {
    if (parsedByPath.has(e.path)) continue;
    const abs = path.join(root, e.path);
    const parsed = await parseCardHtml(abs, ctx);
    if (!parsed) {
      warn("card not readable: " + e.path);
      parsedByPath.set(e.path, null);
      continue;
    }
    parsedByPath.set(e.path, parsed);
  }

  // ---- babel: transform JSX at build time when possible
  const anyBabel = [...parsedByPath.values()].some((p) => p?.scripts.some((s) => s.babel));
  let buildBabel = null;
  let needsRuntimeBabel = false;
  if (anyBabel) {
    buildBabel = await loadBuildBabel(args.offline);
    if (buildBabel) {
      info("transforming JSX at build time (babel " + (buildBabel.version || "standalone") + ")");
      for (const [p, parsed] of parsedByPath) {
        if (!parsed) continue;
        for (const s of parsed.scripts) {
          if (!s.babel) continue;
          try {
            s.code = buildBabel.transform(s.code, {
              presets: [["react", {}]],
              filename: s.name || path.basename(p) + ".jsx",
            }).code;
            s.babel = false;
          } catch (e) {
            warn("babel failed for " + p + (s.name ? " (" + s.name + ")" : "") + ": " + e.message);
          }
        }
      }
    } else {
      needsRuntimeBabel = true;
      warn("babel-standalone unavailable at build time — embedding it for runtime JSX transform");
    }
  }

  // ---- dedupe css + build payload
  const cssBlobs = {};
  const fontFaces = [];
  const seenFonts = new Set();
  const payloadCards = [];
  const sectionHtmlByGroup = new Map();
  let needsReact = false;
  let usesBundle = false;

  let cardIndex = 0;
  for (const e of entries) {
    const parsed = parsedByPath.get(e.path);
    const cid = "card-" + cardIndex++ + "-" + slug(e.title).slice(0, 40);
    e.domId = cid;
    if (!parsed) continue;
    needsReact = needsReact || parsed.needsReact;
    usesBundle = usesBundle || parsed.usesBundle;

    const hashes = [];
    for (const cssText of parsed.cssTexts) {
      const sink = [];
      const scoped = scopeCss(cssText, sink);
      for (const ff of sink) {
        const fh = djb2(ff);
        if (!seenFonts.has(fh)) {
          seenFonts.add(fh);
          fontFaces.push(ff);
        }
      }
      const h = djb2(scoped);
      if (!(h in cssBlobs)) cssBlobs[h] = scoped;
      hashes.push(h);
    }

    const viewport = e.viewport || (e.key.startsWith("tpl:") ? TEMPLATE_VIEWPORT : DEFAULT_VIEWPORT);
    const initialScale = Math.min(INITIAL_CONTENT_WIDTH / viewport.width, 1);

    payloadCards.push({
      id: cid,
      w: viewport.width,
      h: viewport.height,
      base: e.path.includes("/") ? e.path.slice(0, e.path.lastIndexOf("/")) : "",
      css: hashes,
      js: parsed.scripts.map((s) => ({ code: s.code, babel: s.babel, name: s.name })),
    });

    // First card of a section maps to the section's outline item (which
    // targets the section header), mirroring firstItemSectionByKey upstream.
    const isFirstInGroup = !sectionHtmlByGroup.has(e.groupId);
    const html = buildCardSectionHtml(e, cid, parsed, viewport, initialScale, isFirstInGroup ? e.groupId : cid);
    if (isFirstInGroup) sectionHtmlByGroup.set(e.groupId, { label: e.group, cards: [] });
    sectionHtmlByGroup.get(e.groupId).cards.push(html);
  }

  const keyToId = new Map(entries.map((e) => [e.key, e.domId]));

  // ---- readme
  let readmeHtml = null;
  for (const cand of ["readme.md", "README.md", "Readme.md"]) {
    const text = await readMaybe(path.join(root, cand));
    if (text != null) {
      readmeHtml = renderMarkdown(text);
      break;
    }
  }
  if (readmeHtml) {
    // inline images referenced from the readme
    const imgRefs = [...readmeHtml.matchAll(/<img [^>]*src="([^"]+)"/g)].map((m) => m[1]);
    for (const ref of new Set(imgRefs)) {
      const abs = resolveRef(ref, root, root);
      if (!abs) continue;
      const data = await ctx.inlineAsset(abs);
      if (data) readmeHtml = readmeHtml.split('src="' + ref + '"').join('src="' + data + '"');
    }
  }

  // ---- vendored runtimes
  const reactVersion = ctx.reactVersion || DEFAULT_REACT_VERSION;
  const headScripts = [];
  const bodyScripts = [];
  if (needsReact || usesBundle) {
    const reactUrl = "https://unpkg.com/react@" + reactVersion + "/umd/react.production.min.js";
    const reactDomUrl = "https://unpkg.com/react-dom@" + reactVersion + "/umd/react-dom.production.min.js";
    if (args.cdn) {
      headScripts.push('<script crossorigin src="' + reactUrl + '"></script>');
      headScripts.push('<script crossorigin src="' + reactDomUrl + '"></script>');
    } else {
      const react = await vendorFile("react-" + reactVersion + ".production.min.js", reactUrl, args.offline);
      const reactDom = await vendorFile("react-dom-" + reactVersion + ".production.min.js", reactDomUrl, args.offline);
      if (react && reactDom) {
        headScripts.push("<script>" + safeInlineScript(react) + "</script>");
        headScripts.push("<script>" + safeInlineScript(reactDom) + "</script>");
        info("inlined react + react-dom " + reactVersion);
      } else {
        warn("react not available locally — falling back to CDN tags (network needed when viewing)");
        headScripts.push('<script crossorigin src="' + reactUrl + '"></script>');
        headScripts.push('<script crossorigin src="' + reactDomUrl + '"></script>');
      }
    }
  }
  if (needsRuntimeBabel) {
    const babelUrl = "https://unpkg.com/@babel/standalone@" + DEFAULT_BABEL_VERSION + "/babel.min.js";
    if (args.cdn) {
      headScripts.push('<script src="' + babelUrl + '"></script>');
    } else {
      const babel =
        (await readMaybe(path.join(VENDOR_DIR, "babel.min.js"))) ??
        (await vendorFile("babel-standalone-" + DEFAULT_BABEL_VERSION + ".min.js", babelUrl, args.offline));
      if (babel) headScripts.push("<script>" + safeInlineScript(babel) + "</script>");
      else headScripts.push('<script src="' + babelUrl + '"></script>');
    }
  }
  if (usesBundle && ctx.bundlePath) {
    const bundle = await readMaybe(ctx.bundlePath);
    if (bundle != null) {
      headScripts.push("<script>" + safeInlineScript(bundle) + "</script>");
      info("inlined " + path.relative(root, ctx.bundlePath));
    }
  }
  for (const src of ctx.remoteScripts) {
    headScripts.push('<script src="' + escAttr(src) + '"></script>');
    warn("remote script kept as tag (network needed): " + src);
  }
  const remoteCssTags = [...ctx.remoteCss]
    .map((href) => '<link rel="stylesheet" href="' + escAttr(href) + '">')
    .join("\n");
  if (ctx.remoteCss.size) warn("remote stylesheets kept as tags: " + [...ctx.remoteCss].join(", "));

  // ---- content column
  let content = "";
  if (readmeHtml) content += buildReadmeHtml(readmeHtml);
  for (const g of outlineGroups) {
    const sec = sectionHtmlByGroup.get(g.domId);
    if (!sec) continue;
    content +=
      '<div class="ds-group" id="' +
      g.domId +
      '" data-anchor data-anchor-key="' +
      g.domId +
      '">' +
      '<h2 class="ds-group-label">' +
      escHtml(g.label) +
      "</h2>" +
      sec.cards.join("") +
      "</div>";
  }
  if (!entries.length && !readmeHtml) {
    content +=
      '<div class="ds-empty">No cards yet — add &lt;!-- @dsCard group="…" --&gt; as the first line of any .html file.</div>';
  }

  // ---- runtime-fetched assets (only when some card actually calls fetch)
  const anyFetch = [...parsedByPath.values()].some(
    (p) => p && (p.scripts.some((s) => /\bfetch\s*\(/.test(s.code)) || /\bfetch\s*\(/.test(p.bodyHtml)),
  );
  let runtimeAssets = null;
  if (anyFetch) {
    runtimeAssets = await collectRuntimeAssets(root, ctx);
    const n = Object.keys(runtimeAssets).length;
    if (n) info("inlined " + n + " runtime-fetchable asset file(s)");
  }

  const payload = {
    cards: payloadCards,
    css: cssBlobs,
  };
  if (runtimeAssets && Object.keys(runtimeAssets).length) payload.assets = runtimeAssets;
  const payloadJson = JSON.stringify(payload).replace(/</g, "\\u003c");

  const html =
    "<!doctype html>\n" +
    '<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "<title>" +
    escHtml(title) +
    " — Design system</title>\n" +
    remoteCssTags +
    "<style>\n" +
    HOST_CSS +
    "\n" +
    (fontFaces.length ? "/* hoisted @font-face (shadow roots ignore font-face) */\n" + fontFaces.join("\n") + "\n" : "") +
    "</style>\n" +
    headScripts.join("\n") +
    "\n</head>\n<body>\n" +
    '<div class="ds-pane">\n' +
    buildOutlineHtml(outlineGroups, !!readmeHtml, keyToId) +
    '\n<main class="ds-content" data-scroll>\n<div class="ds-content-inner">\n' +
    content +
    "\n</div>\n</main>\n</div>\n" +
    '<script type="application/json" id="ds-data">' +
    payloadJson +
    "</script>\n" +
    "<script>\n" +
    RUNTIME_JS +
    "\n</script>\n" +
    bodyScripts.join("\n") +
    "</body>\n</html>\n";

  await fs.writeFile(outPath, html);
  const bytes = Buffer.byteLength(html);
  console.error(
    "✓ wrote " +
      outPath +
      " (" +
      (bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + " MB" : Math.round(bytes / 1024) + " KB") +
      ", " +
      payloadCards.length +
      " cards" +
      (readmeHtml ? ", readme" : "") +
      ")",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
