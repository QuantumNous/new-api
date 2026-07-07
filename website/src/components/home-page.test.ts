import { describe, expect, test } from "bun:test";
import { getHomeCopy } from "@/lib/home-copy";
import { buildHomeModelRows, pickFlagshipModels } from "@/lib/home-models";
import { LOCALES } from "@/lib/locales";
import type { PricingData } from "@/lib/pricing";

describe("home copy", () => {
  test("every locale has a full copy set", () => {
    for (const locale of LOCALES) {
      const copy = getHomeCopy(locale);
      expect(copy.hero.titleLine1.length).toBeGreaterThan(0);
      expect(copy.stats).toHaveLength(4);
      expect(copy.values.reliability.points).toHaveLength(3);
      expect(copy.values.cost.points).toHaveLength(3);
      expect(copy.values.privacy.points).toHaveLength(3);
    }
  });
});

describe("home model rows", () => {
  const pricing: PricingData = {
    models: [
      { model_name: "gpt-5.4", quota_type: 0, model_ratio: 0.625, completion_ratio: 8, vendor_name: "OpenAI" },
      { model_name: "gpt-5.4-mini", quota_type: 0, model_ratio: 0.125, completion_ratio: 8, vendor_name: "OpenAI" },
      { model_name: "claude-opus-4-8", quota_type: 0, model_ratio: 2.5, completion_ratio: 5, vendor_name: "Anthropic" },
      { model_name: "claude-sonnet-5", quota_type: 0, model_ratio: 1.5, completion_ratio: 5, vendor_name: "Anthropic" },
      { model_name: "gemini-3-pro", quota_type: 0, model_ratio: 0.625, completion_ratio: 8, vendor_name: "Google" },
      { model_name: "sora-2", quota_type: 1, model_ratio: 0, completion_ratio: 1, model_price: 0.4, vendor_name: "OpenAI" },
      { model_name: "free-model", quota_type: 0, model_ratio: 0, completion_ratio: 1, vendor_name: "Other" },
    ],
    vendors: [],
    groupRatio: {},
    usableGroup: {},
    supportedEndpoint: {},
    autoGroups: [],
  };

  test("flagships pick one model per official family, skipping mini variants", () => {
    const rows = pickFlagshipModels(pricing);
    expect(rows.map((row) => row.name)).toEqual(["gpt-5.4", "claude-opus-4-8", "claude-sonnet-5", "gemini-3-pro"]);
  });

  test("flagship rows carry a struck official price and a 2/3 discounted price", () => {
    const [gpt] = pickFlagshipModels(pricing);
    expect(gpt.official).toBe("$1.25");
    expect(gpt.discounted).toBe("$0.833333");
  });

  test("table rows keep only priced token models", () => {
    const names = buildHomeModelRows(pricing).map((row) => row.name);
    expect(names).not.toContain("sora-2");
    expect(names).not.toContain("free-model");
    expect(names).toContain("gpt-5.4-mini");
  });
});
