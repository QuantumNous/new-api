// Headless-browser driver. Same Playwright Chromium wrapper as gen-pptx, plus a
// raw-bytes screenshot and a `seek()` that drives the page's timeline bridge and
// waits two animation frames so React commits the seeked state before capture.

import type { Browser, BrowserContext, Page } from "playwright";

export interface DriverOptions {
  width: number;
  height: number;
  /** Supersample factor. Default 2 (downscaled by ffmpeg with lanczos). */
  deviceScaleFactor?: number;
  /** ms for navigation + default action timeout (default 30000). */
  timeout?: number;
}

export class PlaywrightDriver {
  private browser: Browser;
  private context: BrowserContext;
  readonly page: Page;

  private constructor(browser: Browser, context: BrowserContext, page: Page) {
    this.browser = browser;
    this.context = context;
    this.page = page;
  }

  static async launch(url: string, opts: DriverOptions): Promise<PlaywrightDriver> {
    // Dynamic import keeps playwright out of the hoisted top-level imports so the
    // CLI preflight can surface a friendly "run npm install" hint instead of a
    // raw module-not-found crash at load.
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: opts.width, height: opts.height },
      deviceScaleFactor: opts.deviceScaleFactor ?? 2,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(opts.timeout ?? 30000);
    await page.goto(url, { waitUntil: "load", timeout: opts.timeout ?? 30000 });
    return new PlaywrightDriver(browser, context, page);
  }

  /** Raw full-viewport PNG bytes (fed straight to ffmpeg's stdin). */
  async screenshotBuffer(): Promise<Buffer> {
    return await this.page.screenshot({ type: "png" });
  }

  /** Drive the timeline bridge to time `t` (seconds), then settle two rAFs. */
  async seek(bridgeGlobal: string, t: number): Promise<void> {
    await this.page.evaluate(
      ({ g, time }) => {
        const b = (window as unknown as Record<string, { setTime?: (n: number) => void }>)[g];
        if (b && typeof b.setTime === "function") b.setTime(time);
        return new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        );
      },
      { g: bridgeGlobal, time: t },
    );
  }

  async close(): Promise<void> {
    try {
      await this.context.close();
    } catch {
      /* best-effort */
    }
    try {
      await this.browser.close();
    } catch {
      /* best-effort */
    }
  }
}
