import { describe, expect, test } from "bun:test";
import { publicPricingUrl, sortPricingModelsBySeries, type PricingModel } from "./pricing";

describe("publicPricingUrl", () => {
  test("points website pricing at the cached public API", () => {
    expect(publicPricingUrl("https://router.flatkey.ai")).toBe("https://router.flatkey.ai/api/website/pricing");
  });

  test("defaults public pricing data fetches to the console origin", () => {
    expect(publicPricingUrl()).toBe("https://console.flatkey.ai/api/website/pricing");
  });

  test("can request the allowlisted PLG public pricing view", () => {
    expect(publicPricingUrl("https://console.flatkey.ai", "plg")).toBe("https://console.flatkey.ai/api/website/pricing?group=plg");
  });
});

describe("sortPricingModelsBySeries", () => {
  const baseModel = {
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
  } satisfies Pick<PricingModel, "quota_type" | "model_ratio" | "completion_ratio">;

  test("orders preferred providers before the general provider list", () => {
    const sorted = sortPricingModelsBySeries([
      { ...baseModel, vendor_name: "AI", model_name: "mirothinker-1-7b" },
      { ...baseModel, vendor_name: "Google", model_name: "gemma-4-31b-it" },
      { ...baseModel, vendor_name: "Anthropic", model_name: "claude-sonnet-4" },
      { ...baseModel, vendor_name: "OpenAI", model_name: "gpt-4o-mini" },
      { ...baseModel, vendor_name: "OpenAI", model_name: "gpt-5" },
      { ...baseModel, vendor_name: "Z.ai", model_name: "glm-5" },
    ]);

    expect(sorted.map((model) => `${model.vendor_name}:${model.model_name}`)).toEqual([
      "OpenAI:gpt-4o-mini",
      "OpenAI:gpt-5",
      "Anthropic:claude-sonnet-4",
      "Google:gemma-4-31b-it",
      "AI:mirothinker-1-7b",
      "Z.ai:glm-5",
    ]);
  });
});
