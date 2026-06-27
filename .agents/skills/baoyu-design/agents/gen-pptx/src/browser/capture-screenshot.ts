// Browser-context only. Reveals slide N and settles layout/transitions; the
// actual pixel grab is done Node-side via Playwright page.screenshot(). (←Nt)

import type { SlideSpec } from "../types.ts";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function captureScreenshot(spec: SlideSpec): Promise<void> {
  if (spec.showJs) {
    try {
      new Function(spec.showJs)();
    } catch (e) {
      throw new Error("showJs threw: " + ((e as Error)?.message || e));
    }
  }
  const delay = Number.isFinite(Number(spec.delay)) ? Number(spec.delay ?? 600) : 600;
  await Promise.race([
    new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    sleep(500),
  ]);
  await sleep(delay);
}
