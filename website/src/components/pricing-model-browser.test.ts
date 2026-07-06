import { describe, expect, test } from "bun:test";
import { buildCodeSampleForTest } from "./pricing-model-browser";
import type { PricingModel } from "@/lib/pricing";

const model: PricingModel = {
  model_name: "openai/gpt-4.1",
  quota_type: 0,
  model_ratio: 1,
  completion_ratio: 1,
};

describe("pricing model API samples", () => {
  test("use the router origin for model invocation examples", () => {
    const sample = buildCodeSampleForTest("curl", model, "openai-chat", "/v1/chat/completions");

    expect(sample).toContain("https://router.flatkey.ai/v1/chat/completions");
    expect(sample).not.toContain("https://console.flatkey.ai");
  });

  test("show gpt-5.5 instead of gpt-5 in model parameters", () => {
    const gptModel = { ...model, model_name: "gpt-5" };
    const sample = buildCodeSampleForTest("curl", gptModel, "openai-chat", "/v1/chat/completions");

    expect(sample).toContain('"model": "gpt-5.5"');
    expect(sample).not.toContain('"model": "gpt-5"');
  });
});
