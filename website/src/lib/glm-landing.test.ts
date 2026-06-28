import { describe, expect, test } from "bun:test";
import sitemap from "@/app/sitemap";
import { LOCALES } from "@/lib/locales";
import {
  GLM_LANDING_PATH,
  getGlmLandingCtaUrl,
  getGlmLandingMetadataInput,
  getGlmLandingPageCopy,
} from "./glm-landing";

describe("GLM 5.2 landing page", () => {
  test("uses the approved route and conversion CTA", () => {
    expect(GLM_LANDING_PATH).toBe("/glm-5-2");
    expect(getGlmLandingCtaUrl("https://console.example.test")).toBe(
      "https://console.example.test/sign-up?redirect=/keys"
    );
  });

  test("has complete localized copy for every supported website locale", () => {
    for (const locale of LOCALES) {
      const copy = getGlmLandingPageCopy(locale);

      expect(copy.hero.title).toContain("GLM 5.2");
      expect(copy.hero.subtitle.length).toBeGreaterThan(60);
      expect(copy.reasons).toHaveLength(2);
      expect(copy.features).toHaveLength(6);
      expect(copy.faqs).toHaveLength(3);
      expect(copy.code.model).toBe("glm-5.2");
      expect(copy.visual.status.openai.length).toBeGreaterThan(4);
      expect(copy.visual.status.claude.length).toBeGreaterThan(4);
      expect(copy.visual.status.curl.length).toBeGreaterThan(4);
    }
  });

  test("localizes hero visual status labels", () => {
    const chinese = getGlmLandingPageCopy("zh");

    expect(chinese.visual.status.openai).toBe("兼容接入示例");
    expect(chinese.visual.status.claude).toBe("Claude Code CLI 路由示例");
    expect(chinese.visual.status.curl).toBe("GLM 5.2 模型目标");
  });

  test("keeps English and Portuguese ad keywords in metadata", () => {
    const english = getGlmLandingMetadataInput("en");
    const portuguese = getGlmLandingMetadataInput("pt");

    expect(english.pathname).toBe(GLM_LANDING_PATH);
    expect(english.title.toLowerCase()).toContain("glm 5.2 api");
    expect(english.description.toLowerCase()).toContain("40% off");
    expect(portuguese.title.toLowerCase()).toContain("glm 5.2 api");
    expect(portuguese.description.toLowerCase()).toContain("barato");
  });

  test("adds the GLM page to the sitemap", async () => {
    const entries = await sitemap();

    expect(entries.some((entry) => entry.url === "https://flatkey.ai/glm-5-2")).toBe(true);
    expect(entries.some((entry) => entry.url === "https://flatkey.ai/pt/glm-5-2")).toBe(true);
  });
});
