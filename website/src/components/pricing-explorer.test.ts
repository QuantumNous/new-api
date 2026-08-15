import { describe, expect, test } from "bun:test";
import { modelsHref, normalizePricingSearch } from "./pricing-explorer";

describe("model directory filter links", () => {
  test("builds crawlable /models filter URLs", () => {
    expect(modelsHref("en", { vendor: "Qwen", pricing: "token", endpoint: "openai-chat" })).toBe(
      "/models?vendor=Qwen&pricing=token&endpoint=openai-chat"
    );
    expect(modelsHref("zh", { vendor: "Qwen", pricing: "request" })).toBe("/zh/models?vendor=Qwen&pricing=request");
  });

  test("omits all filters from model directory URLs", () => {
    expect(modelsHref("en", { vendor: "all", pricing: "all", endpoint: "all", q: " " })).toBe("/models");
    expect(modelsHref("en", { vendor: "Qwen", q: "coder" })).toBe("/models?vendor=Qwen");
  });

  test("normalizes old quota filters into pricing filters", () => {
    expect(normalizePricingSearch({ vendor: " Qwen ", quota: " token " })).toEqual({
      vendor: "Qwen",
      pricing: "token",
      endpoint: "all",
    });
  });
});
