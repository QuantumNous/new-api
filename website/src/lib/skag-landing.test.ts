import { describe, expect, test } from "bun:test";
import {
  SKAG_COVERAGE_LINE,
  SKAG_LANDING_SLUGS,
  SKAG_TRUST_LINE,
  getSkagLandingConfig,
  getSkagLandingConfigs,
  getSkagLandingCtaUrl,
  getSkagLandingMetadataInput,
  getSkagLandingPathnames,
} from "./skag-landing";

describe("SKAG landing configuration", () => {
  test("h1 echoes the paid-search keyword for every ad group", () => {
    const h1 = (slug: (typeof SKAG_LANDING_SLUGS)[number]) => {
      const config = getSkagLandingConfig(slug);
      return `${config.h1Lead} ${config.h1Accent}`;
    };

    expect(h1("gpt-api-alternative")).toBe("ChatGPT API Alternative");
    expect(h1("chinese-ai")).toBe("Chinese AI Models, One API");
    expect(h1("chinese-ai-models-api")).toBe("Chinese AI Models API");
    expect(h1("openai-compatible")).toBe("OpenAI-Compatible API");
    expect(h1("gateway")).toBe("LLM API Gateway");
  });

  test("exposes sitemap pathnames matching the (en) routes", () => {
    expect(getSkagLandingPathnames()).toEqual([
      "/gpt-api-alternative",
      "/chinese-ai",
      "/chinese-ai-models-api",
      "/openai-compatible",
      "/gateway",
    ]);
  });

  test("trust line advertises coverage across the major model families", () => {
    expect(SKAG_TRUST_LINE).toContain(SKAG_COVERAGE_LINE);
    for (const family of ["GPT", "Gemini", "Claude", "DeepSeek", "Seedance"]) {
      expect(SKAG_COVERAGE_LINE).toContain(family);
    }
  });

  test("CTA points at the console register page", () => {
    expect(getSkagLandingCtaUrl()).toMatch(/\/register$/);
  });

  test("every config carries pricing, snippet model, SEO copy, and FAQ", () => {
    for (const config of getSkagLandingConfigs()) {
      expect(config.priceRows.length).toBeGreaterThanOrEqual(3);
      expect(config.priceRows.some((row) => row.flatkey.startsWith("$"))).toBe(true);
      for (const row of config.priceRows) {
        expect(row.flatkey.length).toBeGreaterThan(0);
        expect(row.official.length).toBeGreaterThan(0);
      }
      expect(config.exampleModel.length).toBeGreaterThan(0);
      expect(config.seo.title.length).toBeGreaterThan(20);
      expect(config.seo.description.length).toBeGreaterThan(50);
      expect(config.faq.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("metadata is English-only so hreflang never points at missing locales", () => {
    for (const slug of SKAG_LANDING_SLUGS) {
      const input = getSkagLandingMetadataInput(slug);
      expect(input.pathname).toBe(`/${slug}`);
      expect(input.locale).toBe("en");
      expect(input.locales).toEqual(["en"]);
    }
  });
});
