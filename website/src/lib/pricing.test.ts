import { describe, expect, test } from "bun:test";
import {
  buildEffectiveGroupRatio,
  formatMatchingModelName,
  formatGroupTokenPrice,
  getAvailableGroups,
  getPricingData,
  publicPricingUrl,
  sortPricingModelsBySeries,
  type PricingModel,
} from "./pricing";

describe("publicPricingUrl", () => {
  test("points website pricing at the cached public API", () => {
    expect(publicPricingUrl("https://router.flatkey.ai")).toBe("https://router.flatkey.ai/api/website/pricing");
  });

  test("defaults public pricing data fetches to the console origin", () => {
    expect(publicPricingUrl()).toBe("https://console.flatkey.ai/api/website/pricing");
  });

  test("fetches pricing without Next response caching", async () => {
    const originalFetch = globalThis.fetch;
    let fetchInit: RequestInit | undefined;
    try {
      globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
        fetchInit = init;
        return Promise.resolve(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
      }) as typeof fetch;

      await getPricingData();

      expect(fetchInit?.cache).toBe("no-store");
      expect((fetchInit?.headers as Record<string, string>)?.accept).toBe("application/json");
    } finally {
      globalThis.fetch = originalFetch;
    }
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

describe("group model ratio", () => {
  const tokenModel: PricingModel = {
    model_name: "gpt-5.5",
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 2,
  };

  test("overrides the group ratio for a specific model", () => {
    expect(
      buildEffectiveGroupRatio(tokenModel, { plg: 0.9, vip: 0.8 }, { plg: { "gpt-5.5": 0.3 } })
    ).toEqual({ plg: 0.3, vip: 0.8 });
  });

  test("keeps fallback group ratios when a model has partial group overrides", () => {
    expect(
      buildEffectiveGroupRatio({ ...tokenModel, group_ratio: { plg: 0.7 } }, { plg: 0.9, vip: 0.8 }, {})
    ).toEqual({ plg: 0.7, vip: 0.8 });
  });

  test("includes model-specific groups in available group candidates", () => {
    const effectiveRatio = buildEffectiveGroupRatio(tokenModel, { default: 1, plg: 0.9 }, { plg: { "gpt-5.5": 0.3 } });
    expect(
      getAvailableGroups(
        { ...tokenModel, enable_groups: ["default"], group_ratio: effectiveRatio },
        { default: 1, plg: 0.9 },
        { default: { desc: "Default", ratio: 1 }, plg: { desc: "PLG", ratio: 0.9 } }
      )
    ).toEqual(["default", "plg"]);
  });

  test("uses model-specific ratio in group token prices", () => {
    const model = {
      ...tokenModel,
      group_ratio: buildEffectiveGroupRatio(tokenModel, { plg: 0.9 }, { plg: { "gpt-5.5": 0.3 } }),
    };

    expect(formatGroupTokenPrice(model, "plg", { plg: 0.9 }, "input")).toBe("$0.6");
    expect(formatGroupTokenPrice(model, "plg", { plg: 0.9 }, "output")).toBe("$1.2");
  });

  test("matches backend gizmo wildcard model names", () => {
    const model = {
      ...tokenModel,
      model_name: "gpt-4o-gizmo-custom",
    };

    expect(formatMatchingModelName(model.model_name)).toBe("gpt-4o-gizmo-*");
    expect(buildEffectiveGroupRatio(model, { plg: 0.9 }, { plg: { "gpt-4o-gizmo-*": 0.4 } })).toEqual({ plg: 0.4 });
  });

  test("matches backend Gemini thinking-budget wildcard model names", () => {
    const model = {
      ...tokenModel,
      model_name: "gemini-2.5-pro-thinking-32768",
    };

    expect(formatMatchingModelName(model.model_name)).toBe("gemini-2.5-pro-thinking-*");
    expect(buildEffectiveGroupRatio(model, { plg: 0.9 }, { plg: { "gemini-2.5-pro-thinking-*": 0.5 } })).toEqual({
      plg: 0.5,
    });
  });
});
