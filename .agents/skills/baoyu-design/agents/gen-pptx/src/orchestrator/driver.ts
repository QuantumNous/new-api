// Headless-browser driver. Replaces the claude.ai __omUserViewerHandle
// (executeJavaScript / capturePage / lockViewportSize / reload) with a
// Playwright Chromium page. The orchestrator talks only to this interface.

import type { Browser, BrowserContext, Page } from "playwright";

export interface DriverOptions {
  width: number;
  height: number;
  /** 2 for crisp screenshots; 1 for editable (coords only). */
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
    // Dynamic import keeps playwright out of the hoisted top-level imports so
    // the CLI preflight can surface a friendly "run npm install" hint instead
    // of a raw module-not-found crash at load.
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: opts.width, height: opts.height },
      deviceScaleFactor: opts.deviceScaleFactor ?? 1,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(opts.timeout ?? 30000);
    await page.goto(url, { waitUntil: "load", timeout: opts.timeout ?? 30000 });
    return new PlaywrightDriver(browser, context, page);
  }

  /** Full-viewport PNG as a base64 data URL. (←capturePage().toDataURL()) */
  async screenshot(): Promise<string> {
    const buf = await this.page.screenshot({ type: "png" });
    return `data:image/png;base64,${buf.toString("base64")}`;
  }

  async setViewportSize(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
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
