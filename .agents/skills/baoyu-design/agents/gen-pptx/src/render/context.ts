import { pxToInches, clamp } from "../core/units.ts";
import type { Rect, MediaCache } from "../types.ts";

// Minimal structural view of a PptxGenJS slide — the renderer builds dynamic
// option bags (faithful to the original), so option args stay loosely typed.
export interface PptxSlide {
  addText(text: unknown, opts: Record<string, unknown>): void;
  addShape(shapeName: string, opts: Record<string, unknown>): void;
  addImage(opts: Record<string, unknown>): void;
  addNotes(notes: string): void;
  background?: { color: string };
}

export interface RenderContext {
  slide: PptxSlide;
  slideW: number;
  slideH: number;
  originX: number;
  originY: number;
  mediaCache: MediaCache;
  warnings: string[];
  /** Optional from→to font swap map (usually unused; capture already resolved). */
  fontMap?: Record<string, string>;
}

// Page rect → slide-relative inches, clamped to a sane band around the slide. (←Ae)
export function rectToPptx(rect: Rect, ctx: RenderContext): Rect {
  const x = rect.x - ctx.originX;
  const y = rect.y - ctx.originY;
  return {
    x: pxToInches(clamp(x, -ctx.slideW, ctx.slideW * 2)),
    y: pxToInches(clamp(y, -ctx.slideH, ctx.slideH * 2)),
    w: pxToInches(Math.max(clamp(rect.w, 0, ctx.slideW * 2), 1)),
    h: pxToInches(Math.max(clamp(rect.h, 0, ctx.slideH * 2), 1)),
  };
}
