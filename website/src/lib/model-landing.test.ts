import { describe, expect, test } from "bun:test";
import {
  getModelLandingConfig,
  getModelLandingConfigForModel,
  getModelLandingPathnames,
  resolveModelLandingModels,
} from "./model-landing";
import type { PricingModel } from "./pricing";

describe("model landing configuration", () => {
  test("resolves configured landing pages by slug", () => {
    expect(getModelLandingConfig("gpt-api")?.displayName).toBe("GPT-5");
    expect(getModelLandingConfig("missing-model")).toBeNull();
  });

  test("exposes sitemap pathnames for configured model landing pages", () => {
    expect(getModelLandingPathnames()).toEqual([
      "/models/claude-api",
      "/models/gpt-api",
      "/models/seedance-api",
    ]);
  });

  test("matches live pricing models from configured model ids", () => {
    const liveModels: PricingModel[] = [
      {
        model_name: "gpt-5",
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
    expect(resolveModelLandingModels(config!, liveModels).map((model) => model.model_name)).toEqual(["gpt-5"]);
  });

  test("finds landing page config from a live pricing model name", () => {
    expect(getModelLandingConfigForModel("gpt-5-mini")?.slug).toBe("gpt-api");
    expect(getModelLandingConfigForModel("unknown-model")).toBeNull();
  });
});
