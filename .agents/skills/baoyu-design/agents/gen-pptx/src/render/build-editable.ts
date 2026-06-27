import PptxGenJS from "pptxgenjs";
import type {
  CapturedSlide,
  MediaRef,
  ResolvedMedia,
} from "../types.ts";
import { pxToInches } from "../core/units.ts";
import { parseColor } from "../core/color.ts";
import type { PptxSlide } from "./context.ts";
import { renderNodeToPptx } from "./render-node.ts";
import { buildMediaCache } from "./media-cache.ts";

export interface EditableBuildInput {
  width: number;
  height: number;
  slides: CapturedSlide[];
  fontMap?: Record<string, string>;
}

export interface BuildResult {
  buffer: Buffer;
  bytes: number;
  slides: number;
  warnings: string[];
}

// Assemble the editable .pptx from captured slide trees: define the custom
// layout, resolve media via the page, then render each slide's tree into native
// shapes/text. (←Et, with browser write({outputType:"blob"}) → node nodebuffer.)
export async function buildEditablePptx(
  input: EditableBuildInput,
  resolveMedia: (refs: MediaRef[]) => Promise<ResolvedMedia[]>,
): Promise<BuildResult> {
  if (!Array.isArray(input.slides) || input.slides.length === 0) {
    throw new Error("buildEditablePptx: deck has no slides");
  }
  const warnings: string[] = [];
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "CUSTOM", width: pxToInches(input.width), height: pxToInches(input.height) });
  pptx.layout = "CUSTOM";

  const mediaCache = await buildMediaCache(input.slides, warnings, resolveMedia);

  for (const captured of input.slides) {
    const slide = pptx.addSlide() as unknown as PptxSlide;
    const rootBg = parseColor(captured.root.style.backgroundColor);
    if (rootBg && rootBg.alpha === 1) {
      slide.background = { color: rootBg.hex };
      captured.root.style.backgroundColor = "transparent";
    }
    try {
      renderNodeToPptx(captured.root, {
        slide,
        slideW: input.width,
        slideH: input.height,
        originX: captured.rect.x,
        originY: captured.rect.y,
        mediaCache,
        warnings,
        fontMap: input.fontMap,
      });
    } catch (err) {
      warnings.push(`Slide render aborted: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (captured.notes?.trim()) {
      try {
        slide.addNotes(captured.notes);
      } catch (err) {
        warnings.push(`addNotes failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return { buffer, bytes: buffer.length, slides: input.slides.length, warnings };
}
