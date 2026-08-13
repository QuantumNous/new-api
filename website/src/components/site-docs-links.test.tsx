import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteHeader } from "./site-header";

function renderHeader() {
  return renderToStaticMarkup(<SiteHeader locale="en" pathname="/" />);
}

describe("website header documentation links", () => {
  test("keeps Documentation as the only desktop and mobile navigation destination", () => {
    const html = renderHeader();

    expect(html.match(/href="\/docs"/g)).toHaveLength(2);

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
  });
});
