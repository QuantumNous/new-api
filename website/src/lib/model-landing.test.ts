import { describe, expect, test } from "bun:test";
import {
  DEEPSEEK_CONFIG,
  GEMINI_CONFIG,
  GLM_API_CONFIG,
  GPT_IMAGE_2_CONFIG,
  MINIMAX_H3_CONFIG,
  QWEN_CONFIG,
  SONILO_VIDEO_TO_MUSIC_CONFIG,
  getModelLandingConfig,
  getModelLandingConfigForModel,
  getModelLandingConfigForPricingModel,
  getModelLandingPathnames,
  resolveModelLandingModels,
} from "./model-landing";
import type { PricingModel } from "./pricing";

describe("model landing configuration", () => {
  test("defines paid-search landing pages for DeepSeek, Qwen, and GLM APIs", () => {
    expect(getModelLandingConfig("deepseek-api")).toBe(DEEPSEEK_CONFIG);
    expect(getModelLandingConfig("qwen-api")).toBe(QWEN_CONFIG);
    expect(getModelLandingConfig("glm-api")).toBe(GLM_API_CONFIG);

    for (const config of [DEEPSEEK_CONFIG, QWEN_CONFIG, GLM_API_CONFIG]) {
      expect(config.modelIds.length).toBeGreaterThanOrEqual(3);
      expect(config.seo.title.toLowerCase()).toContain("api");
    }
  });

  test("defines a paid-search landing page for the Gemini API", () => {
    expect(getModelLandingConfig("gemini-api")).toBe(GEMINI_CONFIG);
    expect(GEMINI_CONFIG.modelIds.length).toBeGreaterThanOrEqual(3);
    expect(GEMINI_CONFIG.seo.title.toLowerCase()).toContain("gemini api");
    expect(GEMINI_CONFIG.seo.title.toLowerCase()).toContain("openai-compatible");
    expect(getModelLandingConfigForModel("gemini-2.5-pro")?.slug).toBe("gemini-api");
    expect(getModelLandingConfigForModel("gemini-2.5-flash-preview")?.slug).toBe("gemini-api");
  });

  test("resolves configured landing pages by slug", () => {
    expect(getModelLandingConfig("gpt-api")?.displayName).toBe("GPT-5");
    expect(getModelLandingConfig("gpt-image-2")).toBe(GPT_IMAGE_2_CONFIG);
    expect(getModelLandingConfig("gpt-4.1-mini")?.modelId).toBe("gpt-4.1-mini");
    expect(getModelLandingConfig("minimax-h3")).toBe(MINIMAX_H3_CONFIG);
    expect(getModelLandingConfig("sonilo-video-to-music")).toBe(SONILO_VIDEO_TO_MUSIC_CONFIG);
    expect(getModelLandingConfigForModel("gpt-image-2")?.generator?.kind).toBe("image");
    expect(getModelLandingConfigForModel("MiniMax-H3")?.generator?.kind).toBe("video");
    expect(getModelLandingConfigForModel("sonilo-video-to-music")?.generator?.kind).toBe("audio");
    expect(getModelLandingConfig("missing-model")).toBeNull();
  });

  test("exposes sitemap pathnames for configured model landing pages", () => {
    expect(getModelLandingPathnames()).toEqual([
      "/models/claude-api",
      "/models/deepseek-api",
      "/models/gemini-api",
      "/models/gpt-4.1-mini",
      "/models/gpt-image-2",
      "/models/glm-api",
      "/models/gpt-api",
      "/models/minimax-h3",
      "/models/qwen-api",
      "/models/seedance-api",
      "/models/sonilo-video-to-music",
    ]);
  });

  test("matches live pricing models from configured model ids", () => {
    const liveModels: PricingModel[] = [
      {
        model_name: "gpt-5-2026-06-01",
        vendor_name: "OpenAI",
        quota_type: 0,
        model_ratio: 0.35,
        completion_ratio: 8,
      },
      {
        model_name: "seedance-2.0-pro",
        vendor_name: "OpenAI",
        quota_type: 0,
        model_ratio: 0.35,
        completion_ratio: 8,
      },
      {
        model_name: "claude-opus-4",
        vendor_name: "Anthropic",
        quota_type: 0,
        model_ratio: 3.75,
        completion_ratio: 5,
      },
    ];

    const config = getModelLandingConfig("gpt-api");

    expect(config?.modelIds).toContain("gpt-5");
    expect(resolveModelLandingModels(config!, liveModels).map((model) => model.model_name)).toEqual(["gpt-5-2026-06-01"]);
  });

  test("finds landing page config from a live pricing model name", () => {
    expect(getModelLandingConfigForModel("gpt-5-mini")?.slug).toBe("gpt-api");
    expect(getModelLandingConfigForModel("gpt-5.5-fk-cx")?.slug).toBe("gpt-api");
    expect(getModelLandingConfigForModel("gpt-5-2026-06-01")?.slug).toBe("gpt-api");
    expect(getModelLandingConfigForModel("MiniMax-H3")?.slug).toBe("minimax-h3");
    expect(getModelLandingConfigForModel("seedance-2.0-pro")?.slug).toBe("seedance-api");
    expect(getModelLandingConfigForModel("unknown-model")).toBeNull();
  });

  test("builds media landing configs from live pricing endpoint types", () => {
    const sonilo: PricingModel = {
      model_name: "sonilo-video-to-music",
      vendor_name: "Sonilo",
      quota_type: 1,
      model_ratio: 0,
      model_price: 0.009,
      completion_ratio: 0,
      supported_endpoint_types: ["video-to-music"],
    };

    const config = getModelLandingConfigForPricingModel(sonilo);

    expect(config?.slug).toBe("sonilo-video-to-music");
    expect(config?.generator?.kind).toBe("audio");
    expect(config?.generator?.endpoint).toBe("/v1/video-to-music");
    expect(config?.generator?.storageKey).toBe("flatkey:model-generator-draft:sonilo-video-to-music");
  });

  test("builds text landing configs for generic live pricing models", () => {
    const kimi: PricingModel = {
      model_name: "kimi-k2.5",
      vendor_name: "Moonshot AI",
      quota_type: 0,
      model_ratio: 0.3,
      completion_ratio: 4,
      supported_endpoint_types: ["openai"],
    };

    const config = getModelLandingConfigForPricingModel(kimi);

    expect(config.slug).toBe("kimi-k2.5");
    expect(config.modelId).toBe("kimi-k2.5");
    expect(config.officialName).toBe("Moonshot AI");
    expect(config.generator).toBeUndefined();
    expect(config.seo.title).toContain("kimi-k2.5");
  });
});
