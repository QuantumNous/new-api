import { describe, expect, test } from "bun:test";
import { rewriteBlogHref, sanitizeBlogHtml } from "./blog";

describe("rewriteBlogHref", () => {
  test("localizes public blog paths for translated pages", () => {
    expect(rewriteBlogHref("/blog/ai-api-retry-strategy", "zh")).toBe("/zh/blog/ai-api-retry-strategy");
    expect(rewriteBlogHref("/blog/category/gateway-comparisons", "vi")).toBe("/vi/blog/category/gateway-comparisons");
  });

  test("localizes same-site absolute links and preserves query and hash", () => {
    expect(rewriteBlogHref("https://flatkey.ai/pricing?tab=image#units", "zh")).toBe(
      "https://flatkey.ai/zh/pricing?tab=image#units"
    );
  });

  test("keeps non-localized and external links unchanged", () => {
    expect(rewriteBlogHref("/dashboard", "zh")).toBe("/dashboard");
    expect(rewriteBlogHref("https://example.com/blog/post", "zh")).toBe("https://example.com/blog/post");
    expect(rewriteBlogHref("#section-1", "zh")).toBe("#section-1");
  });
});

describe("sanitizeBlogHtml", () => {
  test("rewrites internal marketing links during sanitization", () => {
    const html = sanitizeBlogHtml(
      '<p><a href="/pricing">Pricing</a> and <a href="https://flatkey.ai/sign-up">Get a key</a></p>',
      "zh"
    );

    expect(html).toContain('href="/zh/pricing"');
    expect(html).toContain('href="https://flatkey.ai/zh/sign-up"');
  });
});
