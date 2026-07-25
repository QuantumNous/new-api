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
});
