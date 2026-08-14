import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteConfigProvider } from "./site-config-provider";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SiteShell } from "./site-shell";

const DOCS_URL = "https://docs.example.com/start";

function renderHeader(docsUrl: string | null) {
  return renderToStaticMarkup(
    <SiteConfigProvider docsUrl={docsUrl}>
      <SiteHeader locale="en" pathname="/" />
    </SiteConfigProvider>,
  );
}

function renderFooter(docsUrl: string | null) {
  return renderToStaticMarkup(
    <SiteConfigProvider docsUrl={docsUrl}>
      <SiteFooter locale="en" />
    </SiteConfigProvider>,
  );
}

describe("website documentation links", () => {
  test("renders safe desktop and mobile resource links before Use Cases", () => {
    const html = renderHeader(DOCS_URL);
    const docsAnchors =
      html.match(/<a[^>]+href="https:\/\/docs\.example\.com\/start"[^>]*>/g) ??
      [];

    for (const removedHref of [
      "/blog",
      "/models",
      "/pricing",
      "/compute",
      "/usecases",
      "/playground",
      "/rankings",
      "/status",
      "/about",
      "/careers",
      "/cli",
    ]) {
      expect(html).not.toContain(`href="${removedHref}"`);
    }
    expect(html.indexOf(">Ranking<")).toBeLessThan(html.indexOf(">Documentation<"));
    expect(html.indexOf(">Documentation<")).toBeLessThan(
      html.indexOf(">Use Cases<"),
    );
    expect(html).toContain('aria-label="Toggle navigation menu"');
    expect(html).not.toContain(">Menu<");
  });

  test("renders a safe footer link before legal links", () => {
    const html = renderFooter(DOCS_URL);
    const docsAnchor = html.match(
      /<a[^>]+href="https:\/\/docs\.example\.com\/start"[^>]*>/,
    )?.[0];

    expect(docsAnchor).toContain('target="_blank"');
    expect(docsAnchor).toContain('rel="noopener noreferrer"');
    expect(html.indexOf(">Documentation<")).toBeLessThan(
      html.indexOf(">Terms of Service<"),
    );
    expect(html).toContain('href="https://discord.gg/Xnm8Cc7JRD"');
  });

  test("hides header and footer entries when the setting is unavailable", () => {
    expect(renderHeader(null)).not.toContain("Documentation");
    expect(renderFooter(null)).not.toContain("Documentation");
  });

  test("defaults the public site sign-in link to Google", () => {
    const html = renderToStaticMarkup(
      <SiteConfigProvider docsUrl={DOCS_URL}>
        <SiteShell locale="en" pathname="/">
          <div>body</div>
        </SiteShell>
      </SiteConfigProvider>,
    );

    expect(html).toContain(
      'href="https://console.flatkey.ai/sign-in?lng=en&amp;provider=google"',
    );
  });
});
