import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelsDirectoryTable, buildDirectoryHealthTrend } from "./models-directory-table";
import { getModelsDirectoryTableCopy } from "./pricing-explorer";

describe("ModelsDirectoryTable", () => {
  test("uses default latency and five healthy bars when health data is missing", () => {
    const html = renderToStaticMarkup(
      <ModelsDirectoryTable
        locale="en"
        copy={getModelsDirectoryTableCopy("en")}
        rows={[
          {
            name: "gpt-5-mini",
            vendor: "OpenAI",
            official: "$0.5",
            discounted: "$0.2",
            officialUsd: 0.5,
            discountedUsd: 0.2,
            iconKey: "openai",
          },
        ]}
      />
    );

    expect(html).toContain("Our price");
    expect(html).toContain("Health Score");
    expect(html).not.toContain("After bonus");
    expect(html).not.toContain("30-day health");
    expect(html).toContain("600ms");
    expect(html).toContain(">100%</span>");
    expect(html.match(/title="[^"]* · 100\.00%"/g)?.length).toBe(5);
  });

  test("pads short health trends to five daily points with healthy defaults", () => {
    const day = 24 * 60 * 60;
    const first = Date.UTC(2026, 7, 16) / 1000;
    const second = first + day;

    const points = buildDirectoryHealthTrend([
      { ts: first, success_rate: 97, avg_ttft_ms: 540 },
      { ts: second, success_rate: 92, avg_ttft_ms: 810 },
    ]);

    expect(points).toHaveLength(5);
    expect(points.slice(0, 3)).toEqual([
      { ts: first - day * 3, success_rate: 100, avg_ttft_ms: 600 },
      { ts: first - day * 2, success_rate: 100, avg_ttft_ms: 600 },
      { ts: first - day, success_rate: 100, avg_ttft_ms: 600 },
    ]);
    expect(points.slice(3)).toEqual([
      { ts: first, success_rate: 97, avg_ttft_ms: 540 },
      { ts: second, success_rate: 92, avg_ttft_ms: 810 },
    ]);
  });

  test("renders row-specific pricing units and from text", () => {
    const html = renderToStaticMarkup(
      <ModelsDirectoryTable
        locale="en"
        copy={getModelsDirectoryTableCopy("en")}
        rows={[
          {
            name: "gpt-5-mini",
            vendor: "OpenAI",
            official: "$0.5",
            discounted: "$0.2",
            officialUsd: 0.5,
            discountedUsd: 0.2,
            iconKey: "openai",
            priceUnit: "per 1M tokens",
          },
          {
            name: "video-request-model",
            vendor: "VideoAI",
            official: "$1",
            discounted: "$0.9",
            officialUsd: 1,
            discountedUsd: 0.9,
            iconKey: "videoai",
            priceUnit: "per request",
          },
          {
            name: "video-second-model",
            vendor: "VideoAI",
            official: "$0.08",
            discounted: "$0.072",
            officialUsd: 0.08,
            discountedUsd: 0.072,
            iconKey: "videoai",
            priceUnit: "per second",
            pricePrefix: "from",
          },
        ]}
      />
    );

    expect(html).toContain("per 1M tokens");
    expect(html).toContain("per request");
    expect(html).toContain("per second");
    expect(html).toContain("from</span><span class=\"line-through\">$0.08</span>");
    expect(html).toContain("from</span>$0.072");
    expect(html).not.toContain("$1 /req");
  });

  test("localizes second and request units on the Chinese models page", () => {
    const html = renderToStaticMarkup(
      <ModelsDirectoryTable
        locale="zh"
        copy={getModelsDirectoryTableCopy("zh")}
        rows={[
          {
            name: "video-second-model",
            vendor: "VideoAI",
            official: "$0.08",
            discounted: "$0.072",
            officialUsd: 0.08,
            discountedUsd: 0.072,
            iconKey: "videoai",
            priceUnit: "per second",
          },
          {
            name: "image-request-model",
            vendor: "ImageAI",
            official: "$0.04",
            discounted: "$0.036",
            officialUsd: 0.04,
            discountedUsd: 0.036,
            iconKey: "imageai",
            priceUnit: "per request",
          },
          {
            name: "token-model",
            vendor: "OpenAI",
            official: "$1",
            discounted: "$0.9",
            officialUsd: 1,
            discountedUsd: 0.9,
            iconKey: "openai",
            priceUnit: "per 1M tokens",
          },
        ]}
      />
    );

    expect(html).toContain("/ 秒");
    expect(html).toContain("/ 次");
    expect(html).toContain("/ 1M tokens");
  });
});
