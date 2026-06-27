// Orchestrates a full export: inject → setup → per-slide capture → assemble →
// validate. Returns the .pptx bytes + a structured result; the caller writes to
// disk. (←Dt, with the viewer handle swapped for PlaywrightDriver and host
// download/upload moved to the caller.)

import { pxToInches } from "../core/units.ts";
import { sanitizeStrings, sanitizeFontSwaps } from "../core/sanitize.ts";
import { buildEditablePptx } from "../render/build-editable.ts";
import { buildScreenshotPptx, type ImageTile } from "../render/build-screenshot.ts";
import { validate, type SlideHashResult } from "../validate/validate.ts";
import type { CapturedSlide, GenPptxInput, GenPptxResult, SetupResult } from "../types.ts";
import type { EditableCapture } from "../browser/capture-editable.ts";
import { PlaywrightDriver } from "./driver.ts";
import {
  injectCaptureBundle,
  callSetup,
  callCaptureEditable,
  callCaptureScreenshot,
  callResolveMedia,
} from "./inject.ts";
import { stringifyError, timeoutHint } from "./errors.ts";

export interface RunOutput {
  result: GenPptxResult;
  buffer: Buffer;
}

export async function runGenPptx(rawInput: GenPptxInput, driver: PlaywrightDriver): Promise<RunOutput> {
  const mode = rawInput.mode ?? "editable";
  const input: GenPptxInput = {
    ...rawInput,
    hideSelectors: sanitizeStrings(rawInput.hideSelectors),
    googleFontImports: sanitizeStrings(rawInput.googleFontImports),
    fontSwaps: sanitizeFontSwaps(rawInput.fontSwaps),
  };
  if (!Array.isArray(input.slides) || input.slides.length === 0) {
    throw new Error("genPptx: slides[] is empty");
  }
  const { page } = driver;
  await injectCaptureBundle(page);

  // Screenshots: lock the viewport to the slide size, drop the reset selector,
  // and let one frame settle before setup. (←Dt screenshots preamble.)
  if (mode === "screenshots") {
    await driver.setViewportSize(input.width, input.height);
    await page.evaluate(
      () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        ),
    );
  }

  let setupRes: SetupResult;
  try {
    setupRes = await callSetup(page, {
      mode,
      width: input.width,
      height: input.height,
      hideSelectors: input.hideSelectors,
      googleFontImports: input.googleFontImports,
      fontSwaps: input.fontSwaps,
      resetTransformSelector: mode === "screenshots" ? undefined : input.resetTransformSelector,
    });
  } catch (err) {
    const msg = stringifyError(err);
    throw new Error(`genPptx: setup failed: ${msg}${timeoutHint(msg, "setup")}`);
  }

  if (mode === "editable") {
    const captures: SlideHashResult[] = [];
    const capturedSlides: CapturedSlide[] = [];
    for (let i = 0; i < input.slides.length; i++) {
      let cap: EditableCapture;
      try {
        cap = await callCaptureEditable(page, input.slides[i], input.fontSwaps ?? []);
      } catch (err) {
        const msg = stringifyError(err);
        throw new Error(
          `genPptx: slide ${i + 1}/${input.slides.length} capture failed: ${msg}${timeoutHint(msg, "editable", i + 1)}`,
        );
      }
      const captured: CapturedSlide = { rect: cap.slide.rect, root: cap.slide.root };
      const note = setupRes.notes[i];
      if (note?.trim()) captured.notes = note;
      capturedSlides.push(captured);
      captures.push({ hash: cap.hash, imagesWaited: cap.imagesWaited, imagesFailed: cap.imagesFailed });
    }
    const build = await buildEditablePptx(
      { width: input.width, height: input.height, slides: capturedSlides },
      (refs) => callResolveMedia(page, refs),
    );
    const validation = validate(setupRes, captures, capturedSlides, input, "editable");
    return {
      buffer: build.buffer,
      result: {
        bytes: build.bytes,
        slides: build.slides,
        warnings: build.warnings,
        validation,
        speakerNotes: setupRes.notes.slice(0, input.slides.length),
      },
    };
  }

  // Screenshots mode.
  const wIn = pxToInches(input.width);
  const hIn = pxToInches(input.height);
  const tiles: ImageTile[][] = [];
  const hashes: SlideHashResult[] = [];
  for (let i = 0; i < input.slides.length; i++) {
    let dataUrl: string;
    try {
      await callCaptureScreenshot(page, input.slides[i]);
      dataUrl = await driver.screenshot();
    } catch (err) {
      const msg = stringifyError(err);
      throw new Error(
        `genPptx: slide ${i + 1}/${input.slides.length} capture failed: ${msg}${timeoutHint(msg, "screenshots", i + 1)}`,
      );
    }
    // djb2 over the middle 4096 chars of the data URL. (←Dt hashing.)
    let v = 5381;
    const mid = dataUrl.length >> 1;
    const slice = dataUrl.slice(mid, mid + 4096);
    for (let k = 0; k < slice.length; k++) v = ((v << 5) + v + slice.charCodeAt(k)) | 0;
    hashes.push({ hash: v >>> 0, imagesWaited: 0, imagesFailed: 0 });
    tiles.push([{ data: dataUrl, x: 0, y: 0, w: wIn, h: hIn }]);
  }
  const build = await buildScreenshotPptx(tiles, setupRes.notes, input);
  const validation = validate(setupRes, hashes, [], input, "screenshots");
  return {
    buffer: build.buffer,
    result: {
      bytes: build.bytes,
      slides: build.slides,
      warnings: build.warnings,
      validation,
      speakerNotes: setupRes.notes.slice(0, input.slides.length),
    },
  };
}
