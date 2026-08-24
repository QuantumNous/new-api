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

    expect(h1("gpt-api")).toBe("GPT API");
    expect(h1("gpt-api-alternative")).toBe("ChatGPT API Alternative");
    expect(h1("chinese-ai")).toBe("Chinese AI Models, One API");
    expect(h1("chinese-ai-models-api")).toBe("Chinese AI Models API");
    expect(h1("deepseek-api")).toBe("Stable DeepSeek API");
    expect(h1("claude-api")).toBe("Claude API");
    expect(h1("kimi-api")).toBe("Kimi K2.5 API");
    expect(h1("qwen-api")).toBe("Use Qwen without GPU setup");
    expect(h1("openai-compatible")).toBe("OpenAI-Compatible API");
    expect(h1("gateway")).toBe("LLM API Gateway");
  });

  test("exposes sitemap pathnames matching the (en) routes", () => {
    expect(getSkagLandingPathnames()).toEqual([
      "/gpt-api",
      "/gpt-api-alternative",
      "/chinese-ai",
      "/chinese-ai-models-api",
      "/deepseek-api",
      "/claude-api",
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
    expect(getSkagLandingLocales("gpt-api")).toEqual(["en", "pt"]);
    expect(getSkagLandingLocales("chinese-ai-models-api")).toEqual(["en", "pt"]);
    expect(getSkagLandingLocales("deepseek-api")).toEqual(["en", "pt"]);
    expect(getSkagLandingLocales("claude-api")).toEqual(["en", "pt"]);
    expect(getSkagLandingLocales("kimi-api")).toEqual(["en", "pt"]);
    expect(getSkagLandingLocales("qwen-api")).toEqual(["en", "pt"]);
    expect(getSkagLandingLocales("gateway")).toEqual(["en"]);
  });

  test("exposes the Portuguese Chinese AI models API landing variant", () => {
    const config = getSkagLandingConfig("chinese-ai-models-api", "pt");

    expect(`${config.h1Lead} ${config.h1Accent}`).toBe("Modelos chineses de IA via API");
    expect(config.locale).toBe("pt");
    expect(config.pathname).toBe("/chinese-ai-models-api");
    expect(config.ctaLabel).toBe("Crie sua chave de API grátis");
    expect(config.hideSecondaryCta).toBe(true);
    expect(config.pricingColumns).toEqual({ platform: "Flatkey", reference: "Referência" });
    expect(config.trustLine).toContain("Uma conta");
    expect(config.exampleModel).toBe("deepseek-v4-flash");
    expect(config.features.map((feature) => feature.title)).toContain("Acesso fácil aos modelos chineses de IA");
    expect(config.features.map((feature) => feature.title)).toContain("Modelos de classe mundial para texto, código, raciocínio e vídeo");
  });

  test("Portuguese metadata shares the landing's English and Portuguese alternates", () => {
    const input = getSkagLandingMetadataInput("chinese-ai-models-api", "pt");

    expect(input.pathname).toBe("/chinese-ai-models-api");
    expect(input.locale).toBe("pt");
    expect(input.locales).toEqual(["en", "pt"]);
    expect(input.title).toContain("Modelos chineses de IA via API");
  });

  test("exposes Portuguese DeepSeek paid-search copy", () => {
    const config = getSkagLandingConfig("deepseek-api", "pt");

    expect(config.keyword).toBe("deepseek api");
    expect(`${config.h1Lead} ${config.h1Accent}`).toBe("API DeepSeek estável para código");
    expect(config.ctaLabel).toBe("Obter chave da API DeepSeek");
    expect(config.hideSecondaryCta).toBe(true);
    expect(config.compactHero).toBe(true);
    expect(config.hideCodeWindow).toBe(true);
    expect(config.exampleModel).toBe("deepseek-v4-flash");
  });

  test("exposes Portuguese GPT paid-search copy with current model coverage", () => {
    const config = getSkagLandingConfig("gpt-api", "pt");

    expect(config.keyword).toBe("gpt api");
    expect(`${config.h1Lead} ${config.h1Accent}`).toBe("API GPT para texto e imagem");
    expect(config.ctaLabel).toBe("Obter chave da API GPT");
    expect(config.hideSecondaryCta).toBe(true);
    expect(config.compactHero).toBe(true);
    expect(config.exampleModel).toBe("gpt-5.5");
    expect(config.features.map((item) => item.body).join(" ")).toContain("GPT-5.6 Sol");
    expect(config.faq.map((item) => item.answer).join(" ")).toContain("GPT Image 2");
  });

  test("Portuguese GPT metadata advertises only English and Portuguese alternates", () => {
    const input = getSkagLandingMetadataInput("gpt-api", "pt");

    expect(input.pathname).toBe("/gpt-api");
    expect(input.locale).toBe("pt");
    expect(input.locales).toEqual(["en", "pt"]);
    expect(input.title).toContain("API GPT no Brasil");
  });

  test("exposes Portuguese Claude paid-search copy with current model coverage", () => {
    const config = getSkagLandingConfig("claude-api", "pt");

    expect(config.keyword).toBe("claude api");
    expect(`${config.h1Lead} ${config.h1Accent}`).toBe("API Claude para código e agentes");
    expect(config.ctaLabel).toBe("Obter chave da API Claude");
    expect(config.hideSecondaryCta).toBe(true);
    expect(config.compactHero).toBe(true);
    expect(config.exampleModel).toBe("claude-sonnet-5");
    expect(config.priceRows.map((row) => row.label).join(" ")).toContain("Claude Opus 5");
    expect(config.faq.map((item) => item.answer).join(" ")).toContain("Claude Haiku 4.5");
  });

  test("Portuguese Claude metadata advertises only English and Portuguese alternates", () => {
    const input = getSkagLandingMetadataInput("claude-api", "pt");

    expect(input.pathname).toBe("/claude-api");
    expect(input.locale).toBe("pt");
    expect(input.locales).toEqual(["en", "pt"]);
    expect(input.title).toContain("API Claude no Brasil");
  });

  test("Portuguese DeepSeek metadata advertises only English and Portuguese alternates", () => {
    const input = getSkagLandingMetadataInput("deepseek-api", "pt");

    expect(input.pathname).toBe("/deepseek-api");
    expect(input.locale).toBe("pt");
    expect(input.locales).toEqual(["en", "pt"]);
    expect(input.title).toContain("API DeepSeek estável no Brasil");
  });

  test("exposes Portuguese Kimi and Qwen paid-search copy", () => {
    const kimi = getSkagLandingConfig("kimi-api", "pt");
    const qwen = getSkagLandingConfig("qwen-api", "pt");

    expect(kimi.keyword).toBe("api kimi k2.5");
    expect(`${kimi.h1Lead} ${kimi.h1Accent}`).toBe("API Kimi K2.5 para começar");
    expect(kimi.ctaLabel).toBe("Obter chave da API Kimi K2.5");
    expect(kimi.hideSecondaryCta).toBe(true);
    expect(kimi.compactHero).toBe(true);
    expect(kimi.hideCodeWindow).toBe(true);
    expect(kimi.exampleModel).toBe("kimi-k2.5");

    expect(`${qwen.h1Lead} ${qwen.h1Accent}`).toBe("Use Qwen sem configurar GPU");
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
