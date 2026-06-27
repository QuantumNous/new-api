import PptxGenJS from "pptxgenjs";
import { pxToInches } from "../core/units.ts";
import type { BuildResult } from "./build-editable.ts";

/** One placed image tile on a slide; coords/size already in inches. */
export interface ImageTile {
  data: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Assemble the screenshots .pptx: one slide per image set, each a full-bleed
// (or tiled) raster, plus speaker notes by index. (←jt, write→nodebuffer.)
export async function buildScreenshotPptx(
  slideTiles: ImageTile[][],
  notes: string[],
  input: { width: number; height: number },
): Promise<BuildResult> {
  const warnings: string[] = [];
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "CUSTOM", width: pxToInches(input.width), height: pxToInches(input.height) });
  pptx.layout = "CUSTOM";

  for (let i = 0; i < slideTiles.length; i++) {
    const slide = pptx.addSlide();
    for (const tile of slideTiles[i]) {
      slide.addImage({ data: tile.data, x: tile.x, y: tile.y, w: tile.w, h: tile.h });
    }
    const note = notes[i];
    if (note?.trim()) {
      try {
        slide.addNotes(note);
      } catch (err) {
        warnings.push(`addNotes slide ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return { buffer, bytes: buffer.length, slides: slideTiles.length, warnings };
}
