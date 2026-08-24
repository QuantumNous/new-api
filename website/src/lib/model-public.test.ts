import { describe, expect, test } from "bun:test";
import {
  buildModelPublicView,
  buildModelExampleCurl,
  classifyModelHealthStatus,
  classifyPublicModel,
  modelPublicPath,
  normalizeModelKey,
  resolvePublicModel,
} from "./model-public";
import type { PricingData, PricingModel } from "./pricing";

function model(overrides: Partial<PricingModel>): PricingModel {
  return {
    model_name: "gpt-4o-mini",
    quota_type: 0,
    model_ratio: 1,
    model_price: 0,
    completion_ratio: 1,
    supported_endpoint_types: ["openai"],
    ...overrides,
  } as PricingModel;
}

describe("model slug resolution", () => {
  const models = [
    model({ model_name: "claude-sonnet-4.5" }),
    model({ model_name: "gpt-image-2", supported_endpoint_types: ["image-generation", "openai"] }),
  ];

  test("resolves exact names and url-encoded slugs", () => {
    expect(resolvePublicModel(models, "gpt-image-2")?.model_name).toBe("gpt-image-2");
    expect(resolvePublicModel(models, encodeURIComponent("claude-sonnet-4.5"))?.model_name).toBe(
      "claude-sonnet-4.5"
    );
  });

  test("resolves rankings alias names (vendor prefix, -fk suffix)", () => {
    expect(normalizeModelKey("anthropic/claude-sonnet-4.5")).toBe(normalizeModelKey("claude-sonnet-4.5"));
    expect(resolvePublicModel(models, "anthropic/claude-sonnet-4.5")?.model_name).toBe("claude-sonnet-4.5");
    expect(resolvePublicModel(models, "claude-sonnet-4-5-fk")?.model_name).toBe("claude-sonnet-4.5");
  });

  test("returns null for unknown models", () => {
    expect(resolvePublicModel(models, "definitely-not-a-model")).toBeNull();
  });

  test("malformed percent-encoding resolves to null instead of throwing", () => {
    expect(() => resolvePublicModel(models, "%E0%A4%A")).not.toThrow();
    expect(resolvePublicModel(models, "%E0%A4%A")).toBeNull();
    // No raw-slug fallback: "gpt-image-2%" must not normalize into a hit.
    expect(resolvePublicModel(models, "gpt-image-2%")).toBeNull();
  });

  test("model page paths encode the model name", () => {
    expect(modelPublicPath("claude-sonnet-4.5")).toBe("/models/claude-sonnet-4.5");
    expect(modelPublicPath("a/b")).toBe("/models/a%2Fb");
  });
});

describe("model kind classification", () => {
  test("image-generation tag or image-ish name classifies as image", () => {
    expect(
      classifyPublicModel(model({ model_name: "gpt-image-2", supported_endpoint_types: ["image-generation", "openai"] }))
    ).toBe("image");
    expect(
      classifyPublicModel(model({ model_name: "gemini-2.5-flash-image", supported_endpoint_types: ["gemini", "openai"] }))
    ).toBe("image");
    expect(
      classifyPublicModel(model({ model_name: "nano-banana-pro-preview", supported_endpoint_types: ["image-generation"] }))
    ).toBe("image");
  });

  test("chat surfaces and untagged models classify as chat", () => {
    expect(classifyPublicModel(model({ model_name: "gpt-5.4" }))).toBe("chat");
    expect(classifyPublicModel(model({ model_name: "glm-5.2", supported_endpoint_types: ["anthropic"] }))).toBe("chat");
    expect(classifyPublicModel(model({ model_name: "mystery-model", supported_endpoint_types: [] }))).toBe("chat");
  });
});

describe("model health status", () => {
  test("treats healthy production success rates as operational", () => {
    expect(classifyModelHealthStatus(99.33)).toBe("operational");
    expect(classifyModelHealthStatus(96.8)).toBe("operational");
  });

  test("reserves degraded for material reliability failures", () => {
    expect(classifyModelHealthStatus(94.99)).toBe("degraded");
    expect(classifyModelHealthStatus(56.4)).toBe("degraded");
    expect(classifyModelHealthStatus(undefined)).toBeNull();
  });
});

describe("model public pricing rows", () => {
  const pricingData = (models: PricingModel[] = []): PricingData => ({
    models,
    vendors: [],
    groupRatio: { plg: 0.5 },
    groupModelRatio: {},
    usableGroup: {},
    supportedEndpoint: {},
    autoGroups: [],
  });

  test("keeps legacy token rows per 1M tokens without from pricing", () => {
    const view = buildModelPublicView(
      model({
        model_name: "token-model",
        quota_type: 0,
        model_ratio: 2,
        completion_ratio: 3,
        cache_ratio: 0.25,
        enable_groups: ["plg"],
        group_ratio: { plg: 0.5 },
      }),
      pricingData()
    );

    expect(view.priceRows).toEqual([
      { labelKey: "input", list: "$4", discounted: "$2", unit: "/ 1M tokens", from: false },
      { labelKey: "output", list: "$12", discounted: "$6", unit: "/ 1M tokens", from: false },
      { labelKey: "cacheRead", list: "$1", discounted: "$0.5", unit: "/ 1M tokens", from: false },
    ]);
  });

  test("uses request units for request-billed model prices", () => {
    const view = buildModelPublicView(
      model({
        model_name: "request-model",
        quota_type: 1,
        model_price: 0.12,
        enable_groups: ["plg"],
        group_ratio: { plg: 0.5 },
      }),
      pricingData()
    );

    expect(view.priceRows).toEqual([
      { labelKey: "input", list: "$0.12", discounted: "$0.06", unit: "/ request", from: false },
    ]);
  });

  test("uses display pricing units and from semantics when provided", () => {
    const view = buildModelPublicView(
      model({
        model_name: "realtime-model",
        quota_type: 1,
        model_price: 0.03,
        display_pricing: {
          billing_kind: "per_second",
          prices: {
            second: { configured: 0.03, plg: 0.015, from: true },
          },
        },
      }),
      pricingData()
    );

    expect(view.priceRows).toEqual([
      { labelKey: "input", list: "$0.03", discounted: "$0.015", unit: "/ second", from: true },
    ]);
  });

  test("falls back to legacy request pricing when a per-second display entry is unusable", () => {
    const view = buildModelPublicView(
      model({
        model_name: "malformed-video-model",
        quota_type: 1,
        model_price: 0.12,
        enable_groups: ["plg"],
        group_ratio: { plg: 0.5 },
        display_pricing: {
          billing_kind: "per_second",
          prices: {},
        },
      }),
      pricingData()
    );

    expect(view.priceRows).toEqual([
      { labelKey: "input", list: "$0.12", discounted: "$0.06", unit: "/ request", from: false },
    ]);
  });
});

describe("example curl", () => {
  test("image models demo images/generations with a prompt body", () => {
    const curl = buildModelExampleCurl({
      apiBaseUrl: "https://router.flatkey.ai/v1",
      modelName: "gpt-image-2",
      kind: "image",
    });
    expect(curl).toContain("/v1/images/generations");
    expect(curl).toContain('"prompt"');
    expect(curl).not.toContain("chat/completions");
  });

  test("chat models demo chat/completions with a messages body", () => {
    const curl = buildModelExampleCurl({
      apiBaseUrl: "https://router.flatkey.ai/v1",
      modelName: "gpt-4o-mini",
      kind: "chat",
    });
    expect(curl).toContain("/v1/chat/completions");
    expect(curl).toContain('"messages"');
  });

  test("model names with quotes cannot break the JSON body or shell quoting", () => {
    const curl = buildModelExampleCurl({
      apiBaseUrl: "https://router.flatkey.ai/v1",
      modelName: `evil"model'name`,
      kind: "chat",
    });
    // JSON.stringify escapes the double quote…
    expect(curl).toContain('evil\\"model');
    // …and the single quote uses the POSIX close-escape-reopen pattern.
    expect(curl).toContain(`'\\''`);
    expect(curl.split("-d ")[1].startsWith("'")).toBe(true);
  });
});
