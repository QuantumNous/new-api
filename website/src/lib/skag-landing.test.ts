import { describe, expect, test } from "bun:test";
import {
  SKAG_COVERAGE_LINE,
  SKAG_LANDING_SLUGS,
  SKAG_TRUST_LINE,
  getSkagLandingConfig,
  getSkagLandingConfigs,
  getSkagLandingCtaUrl,
  getSkagLandingLocales,
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
    expect(h1("deepseek-api")).toBe("DeepSeek API");
    expect(h1("kimi-api")).toBe("Kimi API");
    expect(h1("qwen-api")).toBe("Qwen API");
    expect(h1("openai-compatible")).toBe("OpenAI-Compatible API");
    expect(h1("gateway")).toBe("LLM API Gateway");
  });

  test("exposes sitemap pathnames matching the (en) routes", () => {
    expect(getSkagLandingPathnames()).toEqual([
      "/gpt-api-alternative",
      "/chinese-ai",
      "/chinese-ai-models-api",
      "/deepseek-api",
      "/kimi-api",
      "/qwen-api",
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

  test("metadata only advertises locales supported by each landing", () => {
    for (const slug of SKAG_LANDING_SLUGS) {
      const input = getSkagLandingMetadataInput(slug);
      expect(input.pathname).toBe(`/${slug}`);
      expect(input.locale).toBe("en");
      expect(input.locales).toEqual(getSkagLandingLocales(slug));
    }
  });

  test("maps each landing to the locales that have translated copy", () => {
    expect(getSkagLandingLocales("chinese-ai-models-api")).toEqual(["en", "pt"]);
    expect(getSkagLandingLocales("deepseek-api")).toEqual(["en", "pt"]);
    expect(getSkagLandingLocales("kimi-api")).toEqual(["en", "pt"]);
    expect(getSkagLandingLocales("qwen-api")).toEqual(["en", "pt"]);
    expect(getSkagLandingLocales("gateway")).toEqual(["en"]);
  });

  test("exposes the Portuguese Chinese AI models API landing variant", () => {
    const config = getSkagLandingConfig("chinese-ai-models-api", "pt");

    expect(`${config.h1Lead} ${config.h1Accent}`).toBe("Modelos Chineses de IA via API");
    expect(config.locale).toBe("pt");
    expect(config.pathname).toBe("/chinese-ai-models-api");
    expect(config.secondaryCtaLabel).toBe("Ver preços ao vivo");
    expect(config.trustLine).toContain("uma chave, uma fatura");
    expect(config.exampleModel).toBe("deepseek-v4-flash");
  });

  test("Portuguese metadata shares the landing's English and Portuguese alternates", () => {
    const input = getSkagLandingMetadataInput("chinese-ai-models-api", "pt");

    expect(input.pathname).toBe("/chinese-ai-models-api");
    expect(input.locale).toBe("pt");
    expect(input.locales).toEqual(["en", "pt"]);
    expect(input.title).toContain("API de Modelos Chineses de IA");
  });

  test("exposes Portuguese DeepSeek paid-search copy", () => {
    const config = getSkagLandingConfig("deepseek-api", "pt");

    expect(config.keyword).toBe("deepseek api");
    expect(`${config.h1Lead} ${config.h1Accent}`).toBe("API DeepSeek para equipes no Brasil");
    expect(config.ctaLabel).toBe("Obter chave da API DeepSeek");
    expect(config.hideSecondaryCta).toBe(true);
    expect(config.compactHero).toBe(true);
    expect(config.hideCodeWindow).toBe(true);
    expect(config.exampleModel).toBe("deepseek-v4-flash");
  });

  test("Portuguese DeepSeek metadata advertises only English and Portuguese alternates", () => {
    const input = getSkagLandingMetadataInput("deepseek-api", "pt");

    expect(input.pathname).toBe("/deepseek-api");
    expect(input.locale).toBe("pt");
    expect(input.locales).toEqual(["en", "pt"]);
    expect(input.title).toContain("API DeepSeek no Brasil");
  });

  test("exposes Portuguese Kimi and Qwen paid-search copy", () => {
    const kimi = getSkagLandingConfig("kimi-api", "pt");
    const qwen = getSkagLandingConfig("qwen-api", "pt");

    expect(`${kimi.h1Lead} ${kimi.h1Accent}`).toBe("API Kimi para equipes no Brasil");
    expect(kimi.ctaLabel).toBe("Obter chave da API Kimi");
    expect(kimi.hideSecondaryCta).toBe(true);
    expect(kimi.compactHero).toBe(true);
    expect(kimi.hideCodeWindow).toBe(true);
    expect(kimi.exampleModel).toBe("kimi-k2.5");

    expect(`${qwen.h1Lead} ${qwen.h1Accent}`).toBe("API Qwen para equipes no Brasil");
    expect(qwen.ctaLabel).toBe("Obter chave da API Qwen");
    expect(qwen.hideSecondaryCta).toBe(true);
    expect(qwen.compactHero).toBe(true);
    expect(qwen.hideCodeWindow).toBe(true);
    expect(qwen.exampleModel).toBe("qwen3.7-plus");
  });

  test("Portuguese Kimi and Qwen metadata advertise only English and Portuguese alternates", () => {
    for (const slug of ["kimi-api", "qwen-api"] as const) {
      const input = getSkagLandingMetadataInput(slug, "pt");
      expect(input.pathname).toBe(`/${slug}`);
      expect(input.locale).toBe("pt");
      expect(input.locales).toEqual(["en", "pt"]);
    }
  });
});
