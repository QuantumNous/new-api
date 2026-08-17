import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PricingModelBrowser, buildCodeSampleForTest, buildPerformanceMetricsPathForTest, buildPerformanceSummaryPathForTest, resolveGroupPriceRatioForTest } from "./pricing-model-browser";
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

  test("requests PLG-only performance metrics for the public models directory", () => {
    expect(buildPerformanceSummaryPathForTest()).toBe("/api/perf-metrics/summary?hours=24&group=plg");
    expect(buildPerformanceMetricsPathForTest("gpt-4o mini")).toBe("/api/perf-metrics?model=gpt-4o+mini&hours=24&group=plg");
  });
});

describe("PricingModelBrowser pricing units", () => {
  test("renders per-second display pricing on cards", () => {
    const html = renderToStaticMarkup(
      <PricingModelBrowserHarness
        locale="en"
        models={[
          {
            ...model,
            model_name: "seedance-2.0",
            quota_type: 1,
            model_price: 0,
            display_pricing: {
              billing_kind: "per_second",
              prices: { second: { configured: 0.1512, plg: 0.13608, from: true } },
            },
          },
        ]}
      />
    );

    expect(html).toContain("from");
    expect(html).toContain("$0.13608");
    expect(html).toContain("/ second");
    expect(html).toContain("Per Second");
    expect(html).not.toContain("/ request");
  });

  test("localizes per-second unit in Chinese", () => {
    const html = renderToStaticMarkup(
      <PricingModelBrowserHarness
        locale="zh"
        models={[
          {
            ...model,
            model_name: "seedance-2.0",
            quota_type: 1,
            model_price: 0,
            display_pricing: {
              billing_kind: "per_second",
              prices: { second: { configured: 0.1512, plg: 0.13608, from: true } },
            },
          },
        ]}
      />
    );

    expect(html).toContain("/ 秒");
    expect(html).not.toContain("/ second");
  });

  test("renders request display pricing as a single request price", () => {
    const html = renderToStaticMarkup(
      <PricingModelBrowserHarness
        locale="en"
        models={[
          {
            ...model,
            model_name: "image-job-model",
            quota_type: 0,
            model_price: 0,
            display_pricing: {
              billing_kind: "request",
              prices: { request: { configured: 0.04, plg: 0.032 } },
            },
          },
        ]}
      />
    );

    expect(html).toContain("$0.032");
    expect(html).toContain("/ request");
    expect(html).toContain("Per Request");
    expect(html).not.toContain("Input <span");
    expect(html).not.toContain("Output <span");
  });

  test("prefers the model-specific group ratio for group price rows", () => {
    expect(resolveGroupPriceRatioForTest(0.5, 0.9)).toBe(0.5);
    expect(resolveGroupPriceRatioForTest(undefined, 0.9)).toBe(0.9);
    expect(resolveGroupPriceRatioForTest(Number.NaN, 0.9)).toBe(0.9);
    expect(resolveGroupPriceRatioForTest(undefined, undefined)).toBe(1);
  });
});

function PricingModelBrowserHarness(props: { locale: "en" | "zh"; models: PricingModel[] }) {
  return (
    <PricingModelBrowser
      locale={props.locale}
      models={props.models}
      groupRatio={{ plg: 0.9 }}
      usableGroup={{ plg: "PLG" }}
      endpointMap={{}}
      autoGroups={[]}
    />
  );
}
