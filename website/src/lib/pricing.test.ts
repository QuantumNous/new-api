import { describe, expect, test } from "bun:test";
import {
  buildEffectiveGroupRatio,
  formatMatchingModelName,
  formatGroupTokenPrice,
  getAvailableGroups,
  getPricingData,
  publicPricingUrl,
  resolveModelDisplayPrice,
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

  test("can request the allowlisted PLG public pricing view", () => {
    expect(publicPricingUrl("https://console.flatkey.ai", "plg")).toBe("https://console.flatkey.ai/api/website/pricing?group=plg");
  });

  test("fetches pricing without Next response caching", async () => {
    const originalFetch = globalThis.fetch;
    let fetchInput: RequestInfo | URL | undefined;
    let fetchInit: RequestInit | undefined;
    try {
      globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
        fetchInput = _input;
        fetchInit = init;
        return Promise.resolve(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
      }) as typeof fetch;

      await getPricingData("plg");

      expect(String(fetchInput)).toBe("https://console.flatkey.ai/api/website/pricing?group=plg");
      expect(fetchInit?.cache).toBe("no-store");
      expect((fetchInit?.headers as Record<string, string>)?.accept).toBe("application/json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("attaches top-level display pricing to matching models", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (() => {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: [
                {
                  model_name: "seedance-2.0",
                  quota_type: 1,
                  model_ratio: 0,
                  completion_ratio: 1,
                  model_price: 0.2,
                },
              ],
              display_pricing: {
                "seedance-2.0": {
                  billing_kind: "per_second",
                  prices: {
                    second: {
                      configured: "0.1512",
                      plg: "0.13608",
                      from: true,
                    },
                    create_cache: {
                      configured: "0.25",
                      plg: "0.2",
                    },
                  },
                },
              },
            }),
            { status: 200 }
          )
        );
      }) as typeof fetch;

      const data = await getPricingData("plg");

      expect(data.models[0]?.display_pricing).toEqual({
        billing_kind: "per_second",
        prices: {
          second: {
            configured: 0.1512,
            plg: 0.13608,
            from: true,
          },
          create_cache: {
            configured: 0.25,
            plg: 0.2,
            from: false,
          },
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("keeps valid model directory metadata from the pricing payload", async () => {
    const originalFetch = globalThis.fetch;
    try {
      const metadata = {
        author: "OpenAI",
        providers: ["OpenAI"],
        modalities: ["text", "image"],
        context_tokens: 128000,
        series: "GPT",
        categories: ["Programming"],
        released_at: "2026-08-01",
        distillable: false,
        popularity_rank: 2,
        top_ten_rank: 1,
      };
      globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({
        success: true,
        data: [{ model_name: "gpt-5", quota_type: 0, model_ratio: 1, completion_ratio: 1, directory_metadata: metadata }],
      }), { status: 200 }))) as typeof fetch;

      const data = await getPricingData("plg");

      expect(data.models[0]?.directory_metadata).toEqual(metadata);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("drops malformed model directory metadata without dropping pricing", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({
        success: true,
        data: [{
          model_name: "gpt-5",
          quota_type: 0,
          model_ratio: 1,
          completion_ratio: 1,
          directory_metadata: { author: "OpenAI", providers: [], modalities: ["text"], context_tokens: 0 },
        }],
      }), { status: 200 }))) as typeof fetch;

      const data = await getPricingData("plg");

      expect(data.models).toHaveLength(1);
      expect(data.models[0]?.directory_metadata).toBeUndefined();
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

  test("keeps multiple configured featured models ahead in their configured order", () => {
    const sorted = sortPricingModelsBySeries([
      { ...baseModel, vendor_name: "OpenAI", model_name: "gpt-4o-mini" },
      { ...baseModel, vendor_name: "Anthropic", model_name: "claude-sonnet-4", featured_order: 1 },
      { ...baseModel, vendor_name: "OpenAI", model_name: "gpt-5", featured_order: 0 },
    ]);

    expect(sorted.map((model) => model.model_name)).toEqual([
      "gpt-5",
      "claude-sonnet-4",
      "gpt-4o-mini",
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
        { ...tokenModel, enable_groups: ["default"], group_ratio: effectiveRatio, group_model_ratio: { plg: 0.3 } },
        { default: 1, plg: 0.9 },
        { default: "Default", plg: "PLG" }
      )
    ).toEqual(["default", "plg"]);
  });

  test("does not expand explicit groups with fallback ratio groups", () => {
    expect(
      getAvailableGroups(
        { ...tokenModel, enable_groups: ["default"], group_ratio: { default: 1, plg: 0.9, vip: 0.8 } },
        { default: 1, plg: 0.9, vip: 0.8 },
        { default: "Default", plg: "PLG", vip: "VIP" }
      )
    ).toEqual(["default"]);
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

describe("resolveDisplayPrice", () => {
  const tokenModel: PricingModel = {
    model_name: "gpt-image-1",
    quota_type: 0,
    model_ratio: 2.5,
    completion_ratio: 8,
    image_ratio: 2,
    cache_ratio: 0.25,
    group_ratio: { plg: 0.9 },
  };

  test("prefers valid token display pricing over legacy formulas", () => {
    const resolved = resolveModelDisplayPrice(
      {
        ...tokenModel,
        display_pricing: {
          billing_kind: "token",
          prices: {
            input: { configured: 5, plg: 4.5 },
            output: { configured: 40, plg: 36 },
            image: { configured: 10, plg: 9 },
          },
        },
      },
      "output",
      "plg"
    );

    expect(resolved).toEqual({
      text: "$36",
      value: 36,
      variant: "plg",
      dimension: "output",
      configuredValue: 40,
      configured: 40,
      plg: 36,
      unit: "/ 1M tokens",
      from: false,
      source: "display",
    });
  });

  test("resolves per-second display pricing with from flag", () => {
    const resolved = resolveModelDisplayPrice(
      {
        model_name: "seedance-2.0",
        quota_type: 1,
        model_ratio: 0,
        completion_ratio: 1,
        model_price: 0.2,
        display_pricing: {
          billing_kind: "per_second",
          prices: {
            second: { configured: 0.1512, plg: 0.13608, from: true },
          },
        },
      },
      "second",
      "plg"
    );

    expect(resolved).toEqual({
      text: "$0.13608",
      value: 0.13608,
      variant: "plg",
      dimension: "second",
      configuredValue: 0.1512,
      configured: 0.1512,
      plg: 0.13608,
      unit: "/ second",
      from: true,
      source: "display",
    });
  });

  test("resolves request display pricing", () => {
    const resolved = resolveModelDisplayPrice(
      {
        model_name: "dall-e-3",
        quota_type: 1,
        model_ratio: 0,
        completion_ratio: 1,
        model_price: 0.04,
        display_pricing: {
          billing_kind: "request",
          prices: {
            request: { configured: 0.04, plg: 0.036 },
          },
        },
      },
      "request",
      "plg"
    );

    expect(resolved?.unit).toBe("/ request");
    expect(resolved?.text).toBe("$0.036");
    expect(resolved?.value).toBe(0.036);
  });

  test("ignores malformed display values and falls back to legacy token formulas", () => {
    const resolved = resolveModelDisplayPrice(
      {
        ...tokenModel,
        display_pricing: {
          billing_kind: "token",
          prices: {
            input: { configured: Number.POSITIVE_INFINITY, plg: -1 },
          },
        },
      },
      "input",
      "plg"
    );

    expect(resolved).toEqual({
      text: "$4.5",
      value: 4.5,
      variant: "plg",
      dimension: "input",
      configuredValue: 5,
      configured: 5,
      plg: 4.5,
      unit: "/ 1M tokens",
      from: false,
      source: "legacy",
    });
  });

  test("uses the payload group ratio when legacy model rows omit per-model ratios", () => {
    const resolved = resolveModelDisplayPrice(
      {
        model_name: "legacy-model",
        quota_type: 0,
        model_ratio: 2,
        completion_ratio: 1,
        enable_groups: ["plg"],
      },
      "input",
      "plg",
      { plg: 0.5 }
    );

    expect(resolved?.value).toBe(2);
    expect(resolved?.configuredValue).toBe(4);
  });

  test("resolves create-cache display pricing as a token unit", () => {
    const resolved = resolveModelDisplayPrice(
      {
        ...tokenModel,
        display_pricing: {
          billing_kind: "token",
          prices: {
            create_cache: { configured: 1.25, plg: 1 },
          },
        },
      },
      "create_cache",
      "plg"
    );

    expect(resolved?.value).toBe(1);
    expect(resolved?.unit).toBe("/ 1M tokens");
    expect(resolved?.source).toBe("display");
  });

  test("keeps token units for image and audio dimensions that scale token counts", () => {
    const model = {
      ...tokenModel,
      display_pricing: {
        billing_kind: "token" as const,
        prices: {
          image: { configured: 2.5, plg: 2 },
          audio_input: { configured: 5, plg: 4 },
          audio_output: { configured: 15, plg: 12 },
        },
      },
    };

    for (const dimension of ["image", "audio_input", "audio_output"] as const) {
      const resolved = resolveModelDisplayPrice(model, dimension, "plg");
      expect(resolved?.unit).toBe("/ 1M tokens");
      expect(resolved?.source).toBe("display");
    }
  });
});
