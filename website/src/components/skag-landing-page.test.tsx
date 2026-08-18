import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getSkagLandingConfig } from "@/lib/skag-landing";
import { SkagLandingPage } from "./skag-landing-page";

describe("SkagLandingPage", () => {
  test("renders the exact ad keyword echo as the H1", () => {
    const html = renderToStaticMarkup(<SkagLandingPage config={getSkagLandingConfig("gpt-api-alternative")} />);
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
    expect(h1.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()).toBe("ChatGPT API Alternative");
  });

  test("first screen carries the runnable snippet, CTA, and trust line", () => {
    const html = renderToStaticMarkup(<SkagLandingPage config={getSkagLandingConfig("gateway")} />);

    expect(html).toContain("/v1/chat/completions");
    expect(html).toContain("base_url");
    expect(html).toContain("from openai import OpenAI");
    expect(html).toContain("curl");
    expect(html).toContain("/register");
    expect(html).toContain("GPT · Gemini · Claude · DeepSeek · Kimi · Seedance");
  });

  test("renders the configured price table", () => {
    const config = getSkagLandingConfig("chinese-ai");
    const html = renderToStaticMarkup(<SkagLandingPage config={config} />);

    for (const row of config.priceRows) {
      expect(html).toContain(row.label);
      expect(html).toContain(row.flatkey);
    }
  });

  test("renders the Chinese AI models API ad intent", () => {
    const html = renderToStaticMarkup(<SkagLandingPage config={getSkagLandingConfig("chinese-ai-models-api")} />);

    for (const text of ["Chinese AI Models", "DeepSeek", "Qwen", "GLM", "Kimi", "Seedance", "deepseek-v4-flash"]) {
      expect(html).toContain(text);
    }
  });

  test("renders the Portuguese Chinese AI models API landing", () => {
    const html = renderToStaticMarkup(<SkagLandingPage config={getSkagLandingConfig("chinese-ai-models-api", "pt")} />);

    for (const text of [
      "Modelos chineses de IA",
      "Crie sua chave de API grátis",
      "Preços de referência",
      "US$ por 1 milhão de tokens",
      "DeepSeek",
      "Qwen",
      "GLM",
      "Kimi",
      "Seedance",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("Ver preços ao vivo");
    expect(html).not.toContain("from openai import OpenAI");
    expect(html).not.toContain("curl");
  });

  test("uses the shared site shell so paid-search pages retain the homepage navigation", () => {
    const html = renderToStaticMarkup(<SkagLandingPage config={getSkagLandingConfig("deepseek-api", "pt")} />);

    for (const text of ["Produto", "Recursos", "Português", "Começar grátis"]) {
      expect(html).toContain(text);
    }
  });

  test("keeps the DeepSeek primary CTA above the fold without a secondary pricing action", () => {
    const html = renderToStaticMarkup(<SkagLandingPage config={getSkagLandingConfig("deepseek-api", "pt")} />);

    expect(html).toContain("Obter chave da API DeepSeek");
    expect(html).toContain("bg-white text-slate-950");
    expect(html).not.toContain("Ver preços ao vivo");
    expect(html).not.toContain("from openai import OpenAI");
    expect(html).toContain("max-w-6xl");
  });

  test("limits the DeepSeek language switcher to translated locales", () => {
    const html = renderToStaticMarkup(<SkagLandingPage config={getSkagLandingConfig("deepseek-api", "pt")} />);

    expect(html).toContain("English");
    expect(html).toContain("Português");
    for (const label of ["中文", "Español", "Français", "Русский", "日本語", "Tiếng Việt", "Deutsch", "Bahasa Indonesia"]) {
      expect(html).not.toContain(label);
    }
  });

  test("keeps Kimi and Qwen Portuguese pages compact with only their primary CTA", () => {
    for (const [slug, ctaLabel, priceLabel] of [
      ["kimi-api", "Obter chave da API Kimi K2.5", "Kimi K2.5 / 1M tokens"],
      ["qwen-api", "Obter chave da API Qwen", "Qwen 3.7 Plus / 1M tokens"],
    ] as const) {
      const html = renderToStaticMarkup(<SkagLandingPage config={getSkagLandingConfig(slug, "pt")} />);
      expect(html).toContain(ctaLabel);
      expect(html).toContain(priceLabel);
      expect(html).not.toContain("Ver preços ao vivo");
      expect(html).not.toContain("from openai import OpenAI");
      expect(html).toContain("max-w-6xl");
    }
  });

  test("renders the Portuguese GPT page with current model coverage and one primary CTA", () => {
    const html = renderToStaticMarkup(<SkagLandingPage config={getSkagLandingConfig("gpt-api", "pt")} />);

    for (const text of [
      "API GPT",
      "GPT-5.6 Sol",
      "GPT-5.5",
      "GPT Image 2",
      "OpenAI",
      "gpt-5.5",
      "Obter chave da API GPT",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("Ver preços ao vivo");
    expect(html).not.toContain("from openai import OpenAI");
    expect(html).toContain("max-w-6xl");
  });

  test("renders the Portuguese Claude page with current model coverage and one primary CTA", () => {
    const html = renderToStaticMarkup(<SkagLandingPage config={getSkagLandingConfig("claude-api", "pt")} />);

    for (const text of [
      "API Claude",
      "Claude Opus 5",
      "Claude Sonnet 5",
      "Claude Haiku 4.5",
      "OpenAI",
      "claude-sonnet-5",
      "Obter chave da API Claude",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("Ver preços ao vivo");
    expect(html).not.toContain("from openai import OpenAI");
    expect(html).toContain("max-w-6xl");
  });
});
