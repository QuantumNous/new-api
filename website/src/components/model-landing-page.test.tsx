import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelLandingPage } from "./model-landing-page";
import { GPT_CONFIG, GPT_IMAGE_2_CONFIG, SEEDANCE_CONFIG } from "@/lib/model-landing";
import type { PricingModel } from "@/lib/pricing";

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
      <ModelLandingPage config={GPT_CONFIG} locale="en" liveModels={liveModels} />
    );

    expect(html).toContain("$0.7 in / $5.6 out");
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

  test("renders playable video examples for video model landings", () => {
    const html = renderToStaticMarkup(
      <ModelLandingPage config={SEEDANCE_CONFIG} locale="en" liveModels={[]} />
    );

    expect(html).toContain("/assets/video/v1.1.mp4");
    expect(html).toContain("<video");
    expect(html).toContain("controls=\"\"");
    expect(html).toContain("poster=\"/assets/video/v1.1.jpg\"");
  });
});
