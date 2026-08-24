import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("server-only", () => ({}));

describe("OnlineStaticShell", () => {
  test("renders the shared site header and footer with static page styles", async () => {
    const { OnlineStaticShell } = await import("./online-static-shell");
    const html = renderToStaticMarkup(
      <OnlineStaticShell locale="en" pathname="/pricing">
        <div>body</div>
      </OnlineStaticShell>,
    );

    expect(html).toContain("Product");
    expect(html).toContain("Resource");
    expect(html).toContain("Models");
    expect(html).toContain("Pricing");
    expect(html).toContain("<footer");
    expect(html).toContain('data-online-static-stylesheet="true"');
    expect(html).toContain('class="online-static-page"');
    expect(html).toContain('aria-label="Toggle navigation menu"');
    expect(html).not.toContain("<main>");
    expect(html).not.toContain('class="nav pricing-nav"');
    expect(html).not.toContain("mobile-nav-menu");
    expect(html).not.toContain(">Menu<");
  });

  test("defaults the online nav sign-in action to the console sign-in page", async () => {
    const { OnlineStaticShell } = await import("./online-static-shell");
    const html = renderToStaticMarkup(
      <OnlineStaticShell locale="en" pathname="/">
        <div>body</div>
      </OnlineStaticShell>,
    );

    expect(html).toContain(
      'href="https://console.flatkey.ai/sign-in?lng=en"',
    );
  });
});
