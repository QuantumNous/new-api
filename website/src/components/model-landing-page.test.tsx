import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelLandingPage } from "./model-landing-page";
import {
  GPT_CONFIG,
  GPT_IMAGE_2_CONFIG,
  MINIMAX_H3_CONFIG,
  SEEDANCE_CONFIG,
  getModelLandingConfigForPricingModel,
} from "@/lib/model-landing";
import type { PricingModel } from "@/lib/pricing";
import type { RankingsData } from "@/lib/rankings-live";

const gptFamilyModels: PricingModel[] = [
  {
    model_name: "gpt-5.5",
    vendor_name: "OpenAI",
    quota_type: 0,
    model_ratio: 0.5,
    completion_ratio: 8,
    description: "Flagship GPT model for coding and agent workflows.",
    supported_endpoint_types: ["openai"],
    tags: "256K context",
  },
  {
    model_name: "gpt-5",
    vendor_name: "OpenAI",
    quota_type: 0,
    model_ratio: 0.35,
    completion_ratio: 8,
    supported_endpoint_types: ["openai"],
  },
  {
    model_name: "gpt-5-mini",
    vendor_name: "OpenAI",
    quota_type: 0,
    model_ratio: 0.1,
    completion_ratio: 1,
    supported_endpoint_types: ["openai"],
  },
  {
    model_name: "gpt-4o",
    vendor_name: "OpenAI",
    quota_type: 0,
    model_ratio: 0.25,
    completion_ratio: 4,
    supported_endpoint_types: ["openai"],
  },
  {
    model_name: "gpt-4.1",
    vendor_name: "OpenAI",
    quota_type: 0,
    model_ratio: 0.3,
    completion_ratio: 5,
    supported_endpoint_types: ["openai"],
  },
];

const gptRankings: RankingsData = {
  models: [
    { rank: 1, model_name: "gpt-5.5", vendor: "OpenAI", total_tokens: 1200, share: 0.42 },
  ],
  usage: {
    series: ["gpt-5.5"],
    total: 120000,
    days: [
      { label: "Aug 11", total: 1000, values: [1000] },
      { label: "Aug 12", total: 1400, values: [1400] },
      { label: "Aug 13", total: 1800, values: [1800] },
    ],
  },
};

function hrefBeforeText(html: string, text: string): string {
  const textIndex = html.indexOf(`>${text}<`);
  expect(textIndex).toBeGreaterThanOrEqual(0);
  const matches = [...html.slice(0, textIndex).matchAll(/href="([^"]+)"/g)];
  expect(matches.length).toBeGreaterThan(0);
  return matches[matches.length - 1][1].replaceAll("&amp;", "&");
}

describe("ModelLandingPage", () => {
  test("uses the exact configured model as the primary live model", () => {
    const liveModels: PricingModel[] = [
      {
        model_name: "gpt-5-mini",
        vendor_name: "Mini Vendor",
        quota_type: 0,
        model_ratio: 0.1,
        completion_ratio: 1,
      },
      {
        model_name: "gpt-5",
        vendor_name: "Primary Vendor",
        quota_type: 0,
        model_ratio: 0.35,
        completion_ratio: 8,
      },
    ];

    const html = renderToStaticMarkup(
      <ModelLandingPage config={GPT_CONFIG} locale="en" liveModels={liveModels} allModels={liveModels} />
    );

    expect(html).toContain("$0.7");
    expect(html).toContain("$5.6");
    expect(html).not.toContain("$0.2 in / $0.2 out");
  });

  test("opens GPT-image-2 directly in Playground with its model and prompt", () => {
    const html = renderToStaticMarkup(
      <ModelLandingPage config={GPT_IMAGE_2_CONFIG} locale="zh" liveModels={[]} />
    );
    const encodedHref = html.match(/href="([^"]*\/playground\?[^"]*)"/)?.[1];

    expect(encodedHref).toBeDefined();
    const url = new URL(encodedHref!.replaceAll("&amp;", "&"));
    expect(url.pathname).toBe("/playground");
    expect(url.searchParams.get("model")).toBe("gpt-image-2");
    expect(url.searchParams.get("prompt")).toBe(GPT_IMAGE_2_CONFIG.examplePrompt);
    expect(url.searchParams.has("redirect")).toBe(false);
  });

  test("routes the top Get API Key action to the console overview", () => {
    const html = renderToStaticMarkup(
      <ModelLandingPage config={GPT_CONFIG} locale="en" liveModels={[]} />
    );

    expect(hrefBeforeText(html, "Get API Key")).toBe(
      "https://console.flatkey.ai/dashboard",
    );
  });

  test("renders Flatkey homepage-style sections for video model landings", () => {
    const html = renderToStaticMarkup(
      <ModelLandingPage config={SEEDANCE_CONFIG} locale="en" liveModels={[]} />
    );

    for (const id of ["workbench", "health", "providers", "related", "faq"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("Playground (edit before sign-up)");
    expect(html).toContain("Generator setup");
    expect(html).toContain("Open in Playground");
    expect(html).toContain("Request preview");
    expect(html).toContain("Model price comparison");
    expect(html).toContain("Model catalog");
    expect(html).toContain("Related models");
    expect(html).toContain("Frequently asked questions");
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"@type":"FAQPage"');
  });

  test("renders breadcrumbs on media model landings", () => {
    const html = renderToStaticMarkup(
      <ModelLandingPage config={SEEDANCE_CONFIG} locale="en" liveModels={[]} />
    );

    expect(html).toContain("aria-label=\"Breadcrumb\"");
    expect(html).toContain("href=\"/models\"");
    expect(html).toContain("All models");
    expect(html).toContain("Seedance 2.0");
  });

  test("renders back and playground actions on localized media model landings", () => {
    const html = renderToStaticMarkup(
      <ModelLandingPage config={MINIMAX_H3_CONFIG} locale="zh" liveModels={[]} />
    );

    expect(html).toContain('href="/zh/models"');
    expect(html).toContain("返回模型列表");
    expect(html).toContain("在 Playground 打开");
    expect(html).toContain("获取 API Key");
    expect(html).toContain("https://console.flatkey.ai/playground");
    expect(html).toContain("model=MiniMax-H3");
  });

  test("renders Flatkey sections and related model links on localized Sonilo model pages", () => {
    const sonilo: PricingModel = {
      model_name: "sonilo-video-to-music",
      vendor_name: "Sonilo",
      quota_type: 1,
      model_ratio: 0,
      model_price: 0.009,
      completion_ratio: 0,
      supported_endpoint_types: ["video-to-music"],
    };
    const relatedModels: PricingModel[] = [
      sonilo,
      {
        model_name: "gpt-image-2",
        vendor_name: "OpenAI",
        quota_type: 1,
        model_ratio: 0,
        model_price: 0.04,
        completion_ratio: 0,
        supported_endpoint_types: ["image-generation"],
      },
      {
        model_name: "seedance-2.0-pro",
        vendor_name: "ByteDance",
        quota_type: 1,
        model_ratio: 0,
        model_price: 0.047,
        completion_ratio: 0,
        supported_endpoint_types: ["video"],
      },
    ];
    const config = getModelLandingConfigForPricingModel(sonilo);
    const html = renderToStaticMarkup(
      <ModelLandingPage config={config} locale="zh" liveModels={[sonilo]} allModels={relatedModels} />
    );

    expect(html).toContain("供应商");
    expect(html).toContain("价格");
    expect(html).toContain("性能");
    expect(html).toContain("可用性");
    expect(html).toContain("模型价格对比");
    expect(html).toContain("实时模型健康");
    expect(html).toContain("生成器配置");
    expect(html).toContain("Playground（注册前可编辑）");
    expect(html).toContain("在 Playground 打开");
    expect(html).toContain("请求预览");
    expect(html).toContain("可用目录条目");
    expect(html).toContain("常见问题");
    expect(html).toContain("继续浏览 Flatkey");
    expect(html).toContain('href="/zh/models/gpt-image-2"');
    expect(html).toContain('href="/zh/models/seedance-api"');
    expect(html).toContain('"url":"https://flatkey.ai/zh/models/sonilo-video-to-music"');
  });

  test("renders GPT-series related model internal links on GPT model pages", () => {
    const gpt55Config = { ...GPT_CONFIG, slug: "gpt-5.5", displayName: "gpt-5.5", modelId: "gpt-5.5" };
    const html = renderToStaticMarkup(
      <ModelLandingPage
        config={gpt55Config}
        locale="en"
        liveModels={[gptFamilyModels[0]]}
        allModels={gptFamilyModels}
        rankings={gptRankings}
      />
    );

    expect(html).toContain("More models from OpenAI");
    expect(html).toContain('href="/models/gpt-5"');
    expect(html).toContain('href="/models/gpt-5-mini"');
    expect(html).toContain('href="/models/gpt-4o"');
    expect(html).toContain("120K");
    const relatedSection = html.slice(html.indexOf('id="related"'), html.indexOf('id="faq"'));
    expect(relatedSection).toContain('class="relative z-10 border-y border-violet-500/10 bg-white px-6 py-16 dark:bg-white/[0.02]"');
    expect(relatedSection).toContain("bg-white p-4 shadow-none");
    expect(relatedSection).toContain("shadow-none");
    expect(relatedSection).not.toContain("bg-white/72");
    expect(relatedSection).not.toContain("backdrop-blur-sm");
  });

  test("renders breadcrumbs on text model landings", () => {
    const html = renderToStaticMarkup(
      <ModelLandingPage config={GPT_CONFIG} locale="en" liveModels={[]} />
    );

    expect(html).toContain("aria-label=\"Breadcrumb\"");
    expect(html).toContain("href=\"/models\"");
    expect(html).toContain("All models");
    expect(html).toContain("gpt-5");
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"url":"https://flatkey.ai/models/gpt-api"');
    expect(html).not.toContain('id="workbench"');
  });
});
