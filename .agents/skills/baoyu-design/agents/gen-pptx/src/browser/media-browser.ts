// Browser-context only. Resolves media refs in-page so canvas pixels, shadow-
// DOM imgs, and the deck's own credentials/origin all stay reachable. Returns
// base64 data URLs to Node. (←$e/ft/ut/Ie/pt/de + mt's 6-way pool.)

import type { MediaRef, ResolvedMedia, MediaEntry } from "../types.ts";
import { rasterizeGradient } from "./gradient.ts";

const POOL = 6;
const MAX_RASTER = 2048;

// In-page fetch. The deck is served from its own origin under Playwright, so
// the claude.ai host RPC / allowlist (qe/Ge/Ve/Ke) collapses to: same-origin
// credentials when same origin, omit otherwise. (←$e, host plumbing removed.)
async function fetchBlob(url: string): Promise<Blob> {
  let u: URL;
  try {
    u = new URL(url, location.href);
  } catch {
    throw new Error("blocked host");
  }
  const sameOrigin = u.origin === location.origin;
  const res = await fetch(u.href, { credentials: sameOrigin ? "same-origin" : "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

// Blob → data URL. (←de)
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Target raster size from intrinsic / viewBox / requested dims. (←pt)
function svgSizeFit(
  natW: number | undefined,
  natH: number | undefined,
  vbW: number | undefined,
  vbH: number | undefined,
  reqW?: number,
  reqH?: number,
): { w: number; h: number } {
  if (reqW && reqH) {
    const d = Math.max(natW ?? 0, reqW);
    const l = Math.max(natH ?? 0, reqH);
    const a = Math.min(1, MAX_RASTER / Math.max(d, l));
    return { w: Math.max(1, d * a), h: Math.max(1, l * a) };
  }
  if (vbW && vbH) {
    const d = Math.min(1, MAX_RASTER / Math.max(vbW, vbH));
    return { w: Math.max(1, vbW * d), h: Math.max(1, vbH * d) };
  }
  return { w: 300, h: 150 };
}

// Rasterize an SVG blob to a PNG data URL at 2× for crisp scaling. (←Ie)
async function rasterizeSvgBlob(
  blob: Blob,
  reqW?: number,
  reqH?: number,
): Promise<MediaEntry | null> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("SVG decode failed"));
      el.src = objectUrl;
    });
    const natW = img.naturalWidth || undefined;
    const natH = img.naturalHeight || undefined;
    let vbW = natW;
    let vbH = natH;
    if (!vbW || !vbH) {
      try {
        const head = ((await blob.text()).match(/<svg\b[^>]*>/i)?.[0] ?? "").match(
          /\bviewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i,
        );
        if (head) {
          vbW = parseFloat(head[1]) || undefined;
          vbH = parseFloat(head[2]) || undefined;
        }
      } catch {
        /* viewBox parse best-effort */
      }
    }
    const { w, h } = svgSizeFit(natW, natH, vbW, vbH, reqW, reqH);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * 2));
    canvas.height = Math.max(1, Math.round(h * 2));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/png"), w: vbW, h: vbH };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// A raster URL or remote .svg → data URL (+ intrinsic size for rasters). (←ft)
async function inlineImageRef(url: string, warnings: string[]): Promise<MediaEntry | null> {
  try {
    const blob = await fetchBlob(url);
    if (blob.type.includes("svg") || url.toLowerCase().endsWith(".svg")) {
      const entry = await rasterizeSvgBlob(blob);
      if (!entry) warnings.push(`Failed to rasterise SVG from ${url} (decode failed)`);
      return entry;
    }
    const dataUrl = await blobToDataUrl(blob);
    let w: number | undefined;
    let h: number | undefined;
    try {
      const bmp = await createImageBitmap(blob);
      w = bmp.width;
      h = bmp.height;
      bmp.close();
    } catch {
      /* size is optional */
    }
    return { dataUrl, w, h };
  } catch (err) {
    warnings.push(`Failed to inline image ${url}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// Inline <image href> children of an inline <svg>, ensure xmlns, rasterize. (←ut)
async function inlineSvgMarkup(
  markup: string,
  w: number,
  h: number,
  warnings: string[],
): Promise<MediaEntry | null> {
  const re = /<image\b[^>]*?\b(?:xlink:)?href=["']([^"']+)["']/gi;
  const hrefs = new Set<string>();
  for (let m: RegExpExecArray | null; (m = re.exec(markup)); ) {
    if (!m[1].startsWith("data:")) hrefs.add(m[1]);
  }
  for (const href of [...hrefs].sort((a, b) => b.length - a.length)) {
    try {
      const dataUrl = await blobToDataUrl(await fetchBlob(href));
      markup = markup.split(href).join(dataUrl);
    } catch (err) {
      warnings.push(
        `Failed to inline <image href="${href}"> in SVG: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (!/^\s*<svg\b[^>]*\bxmlns\s*=/i.test(markup)) {
    markup = markup.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const blob = new Blob([markup], { type: "image/svg+xml" });
  const entry = await rasterizeSvgBlob(blob, w, h);
  if (!entry) {
    warnings.push(`Failed to rasterise inline <svg> (${w}×${h}px): ${markup.slice(0, 80)}…`);
  }
  return entry;
}

// Resolve every ref through a 6-way concurrency pool. (←mt's pool body.)
export async function resolveMedia(refs: MediaRef[]): Promise<ResolvedMedia[]> {
  const out: ResolvedMedia[] = refs.map((r) => ({ key: r.key, value: null, warnings: [] }));
  const tasks = refs.map((ref, idx) => async (): Promise<void> => {
    const warnings: string[] = [];
    let value: MediaEntry | null;
    if (ref.kind === "url") {
      value = await inlineImageRef(ref.url, warnings);
    } else if (ref.kind === "svg") {
      value = await inlineSvgMarkup(ref.svg, ref.w, ref.h, warnings);
    } else {
      const dataUrl = rasterizeGradient(ref.css, ref.w, ref.h, ref.radius);
      value = dataUrl ? { dataUrl } : null;
      if (!dataUrl) warnings.push(`Failed to rasterize gradient: ${ref.css.slice(0, 80)}…`);
    }
    out[idx] = { key: ref.key, value, warnings };
  });
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(POOL, tasks.length) || 1 }, async () => {
      while (i < tasks.length) await tasks[i++]();
    }),
  );
  return out;
}
