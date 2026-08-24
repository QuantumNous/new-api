import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ApifyAlternativePage } from "./apify-alternative-page";

describe("ApifyAlternativePage", () => {
  test("renders the exact paid-search keyword as the H1", () => {
    const html = renderToStaticMarkup(<ApifyAlternativePage />);
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
    expect(h1.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()).toBe("Apify Alternative");
  });

  test("renders comparison sources, migration content, and both conversion paths", () => {
    const html = renderToStaticMarkup(<ApifyAlternativePage />);
    expect(html).toContain("Apify Actors documentation");
    expect(html).toContain("https://docs.apify.com/platform/actors");
    expect(html).toContain("Low-risk migration");
    expect(html).toContain("/api-marketplace?lng=en");
    expect(html).toContain("/sign-up?redirect=%2Fapi-marketplace&amp;lng=en");
    expect(html).toContain("Flatkey is not affiliated with Apify");
    expect(html).not.toContain('aria-label="Change language"');
  });
});
