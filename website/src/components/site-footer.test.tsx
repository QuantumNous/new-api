import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  test("links non-careers locales to the canonical English careers page", () => {
    const html = renderToStaticMarkup(<SiteFooter locale="fr" />);

    expect(html).toContain('href="/careers"');
    expect(html).not.toContain('href="/fr/careers"');
  });

  test("keeps the Chinese careers link localized because that page exists", () => {
    const html = renderToStaticMarkup(<SiteFooter locale="zh" />);

    expect(html).toContain('href="/zh/careers"');
  });
});
