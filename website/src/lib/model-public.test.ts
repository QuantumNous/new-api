import { describe, expect, test } from "bun:test";
import {
  buildModelExampleCurl,
  classifyPublicModel,
  modelPublicPath,
  normalizeModelKey,
  resolvePublicModel,
} from "./model-public";
import type { PricingModel } from "./pricing";

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
