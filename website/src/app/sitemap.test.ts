import { describe, expect, test } from "bun:test";

describe("sitemap", () => {
  test("omits non-canonical query pages and redirect-only model aliases", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = ((input: RequestInfo | URL) => {
        if (String(input).includes("/api/website/pricing")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: [
                  {
                    model_name: "gpt-5",
                    vendor_name: "OpenAI",
                    quota_type: 0,
                    model_ratio: 1,
                    completion_ratio: 1,
                  },
                ],
                vendors: [],
              }),
              { status: 200 }
            )
          );
        }
        return Promise.resolve(new Response("not found", { status: 404 }));
      }) as typeof fetch;

      const { default: sitemap } = await import("./sitemap");
      const urls = (await sitemap()).map((entry) => entry.url);

      expect(urls.some((url) => url.includes("?vendor="))).toBe(false);
      expect(urls).not.toContain("https://flatkey.ai/models/gpt-api");
      expect(urls).not.toContain("https://flatkey.ai/models/claude-api");
      expect(urls).toContain("https://flatkey.ai/gpt-api");
      expect(urls).toContain("https://flatkey.ai/claude-api");
      expect(urls).toContain("https://flatkey.ai/pt/5-credit-promo");
      expect(urls).not.toContain("https://flatkey.ai/5-credit-promo");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
