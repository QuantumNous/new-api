import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteHeaderDesktopActions } from "./site-header";

describe("SiteHeaderDesktopActions", () => {
  test("renders Contact sales next to Console for authenticated visitors", () => {
    const html = renderToStaticMarkup(
      <SiteHeaderDesktopActions
        accountHref="https://console.flatkey.ai/dashboard"
        accountLabel="Console"
        contactSalesHref="/contact"
        contactSalesLabel="Contact sales"
        consoleSessionActive={true}
        signUpHref="https://console.flatkey.ai/sign-up?lng=en"
        startFreeLabel="Start Free"
      />,
    );

    expect(html).toContain('href="https://console.flatkey.ai/dashboard"');
    expect(html).toContain(">Console<");
    expect(html).toContain('href="/contact"');
    expect(html).toContain(">Contact sales<");
    expect(html.indexOf(">Console<")).toBeLessThan(
      html.indexOf(">Contact sales<"),
    );
    expect(html).not.toContain(">Start Free<");
  });
});
