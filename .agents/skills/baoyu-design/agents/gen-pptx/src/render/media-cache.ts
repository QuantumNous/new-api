import type {
  SlideNode,
  CapturedSlide,
  MediaCache,
  MediaRef,
  ResolvedMedia,
} from "../types.ts";

// FNV-1a → base36. Stable key for an inline <svg>'s serialized markup. (←ht)
export function hashSvg(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

// Cache key for a node's media: raster URL verbatim, svg:<hash>:<w>x<h>, or
// grad:<hash>:<w>x<h>:r<radius> for a rasterized gradient. (←ae)
export function imageKey(node: SlideNode): string | null {
  if (node.imageUrl) return node.imageUrl;
  if (node.svg) return `svg:${hashSvg(node.svg)}:${node.rect.w}x${node.rect.h}`;
  if (node.gradient) {
    return `grad:${hashSvg(node.gradient)}:${Math.round(node.rect.w)}x${Math.round(
      node.rect.h,
    )}:r${Math.round(node.gradientRadius ?? 0)}`;
  }
  return null;
}

export interface GradientRef {
  css: string;
  w: number;
  h: number;
  radius: number;
}

// Walk the tree collecting distinct image URLs, inline svgs, and gradients. (←Le)
export function collectImageRefs(
  node: SlideNode,
  urls: Set<string>,
  svgs: Map<string, { svg: string; w: number; h: number }>,
  grads: Map<string, GradientRef>,
): void {
  if (node.imageUrl) {
    urls.add(node.imageUrl);
  } else if (node.svg) {
    const key = imageKey(node)!;
    if (!svgs.has(key)) svgs.set(key, { svg: node.svg, w: node.rect.w, h: node.rect.h });
  } else if (node.gradient) {
    const key = imageKey(node)!;
    if (!grads.has(key)) {
      grads.set(key, {
        css: node.gradient,
        w: node.rect.w,
        h: node.rect.h,
        radius: node.gradientRadius ?? 0,
      });
    }
  }
  for (const child of node.children) collectImageRefs(child, urls, svgs, grads);
}

// Collect distinct media refs across all slides, resolve them in-page (fetch +
// rasterize → data URL), and assemble the cache the renderer reads. (←mt, with
// the 6-way fetch pool living browser-side in resolveMedia.)
export async function buildMediaCache(
  slides: CapturedSlide[],
  warnings: string[],
  resolveMedia: (refs: MediaRef[]) => Promise<ResolvedMedia[]>,
): Promise<MediaCache> {
  const urls = new Set<string>();
  const svgs = new Map<string, { svg: string; w: number; h: number }>();
  const grads = new Map<string, GradientRef>();
  for (const slide of slides) collectImageRefs(slide.root, urls, svgs, grads);

  const refs: MediaRef[] = [];
  for (const url of urls) refs.push({ kind: "url", key: url, url });
  for (const [key, { svg, w, h }] of svgs) refs.push({ kind: "svg", key, svg, w, h });
  for (const [key, { css, w, h, radius }] of grads)
    refs.push({ kind: "gradient", key, css, w, h, radius });

  const cache: MediaCache = new Map();
  if (refs.length === 0) return cache;

  const resolved = await resolveMedia(refs);
  for (const r of resolved) {
    for (const w of r.warnings) warnings.push(w);
    cache.set(r.key, r.value);
  }
  return cache;
}
