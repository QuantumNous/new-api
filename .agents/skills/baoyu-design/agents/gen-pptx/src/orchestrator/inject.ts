// Loads the compiled capture IIFE into the page once, then exposes typed
// wrappers that drive window.__genpptx via page.evaluate(). Replaces the
// original's string-template executeJavaScript with a bundled, typed surface.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import type {
  FontSwap,
  MediaRef,
  ResolvedMedia,
  SetupResult,
  SlideSpec,
} from "../types.ts";
import type { SetupInput } from "../browser/setup.ts";
import type { EditableCapture } from "../browser/capture-editable.ts";

let cached: string | null = null;
function bundleSource(): string {
  if (cached == null) {
    // At runtime this module is bundled into dist/cli.mjs; capture.iife.js
    // sits beside it.
    const path = fileURLToPath(new URL("./capture.iife.js", import.meta.url));
    cached = readFileSync(path, "utf8");
  }
  return cached;
}

export async function injectCaptureBundle(page: Page): Promise<void> {
  await page.addScriptTag({ content: bundleSource() });
  const ok = await page.evaluate(
    () => typeof (window as unknown as { __genpptx?: unknown }).__genpptx === "object",
  );
  if (!ok) throw new Error("capture bundle failed to initialise window.__genpptx");
}

type Win = { __genpptx: import("../browser/entry.ts").GenPptxApi };

// Bound each in-page call so a never-settling slide (runaway showJs/animation)
// can't hang the export. (←the original wraps every executeJavaScript in a
// per-call timeout: setup 15000ms, editable/screenshots 15000 + (delay ?? 600).)
// The message must contain "timed out" so errors.ts timeoutHint() fires the
// retry guidance.
function evaluateWithTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, guard]).finally(() => clearTimeout(timer)) as Promise<T>;
}

// Mirrors the original's `delay ?? 600` added on top of the 15s base budget.
function captureBudget(spec: SlideSpec): number {
  const d = Number((spec as { delay?: unknown }).delay);
  return 15000 + (Number.isFinite(d) ? d : 600);
}

export function callSetup(page: Page, input: SetupInput): Promise<SetupResult> {
  return evaluateWithTimeout(
    page.evaluate((arg) => (window as unknown as Win).__genpptx.setup(arg), input),
    15000,
    "setup",
  );
}

export function callCaptureEditable(
  page: Page,
  spec: SlideSpec,
  fontSwaps: FontSwap[],
): Promise<EditableCapture> {
  return evaluateWithTimeout(
    page.evaluate(
      ([s, f]) => (window as unknown as Win).__genpptx.captureEditable(s, f),
      [spec, fontSwaps] as [SlideSpec, FontSwap[]],
    ),
    captureBudget(spec),
    "editable capture",
  );
}

export function callCaptureScreenshot(page: Page, spec: SlideSpec): Promise<void> {
  return evaluateWithTimeout(
    page.evaluate((s) => (window as unknown as Win).__genpptx.captureScreenshot(s), spec),
    captureBudget(spec),
    "screenshot capture",
  );
}

export function callResolveMedia(page: Page, refs: MediaRef[]): Promise<ResolvedMedia[]> {
  return page.evaluate((r) => (window as unknown as Win).__genpptx.resolveMedia(r), refs);
}
