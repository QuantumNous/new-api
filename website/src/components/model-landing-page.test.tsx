import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelLandingPage } from "./model-landing-page";
import { GPT_CONFIG } from "@/lib/model-landing";
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

    expect(html.indexOf("Primary Vendor")).toBeLessThan(html.indexOf("Mini Vendor"));
  });

  test("uses gpt-5.5 in the GPT SDK parameter example", () => {
    const html = renderToStaticMarkup(
      <ModelLandingPage config={GPT_CONFIG} locale="en" liveModels={[]} />
    );

    expect(html).toContain("&quot;gpt-5.5&quot;");
    expect(html).not.toContain("model=<span class=\"text-emerald-600\">&quot;gpt-5&quot;</span>");
  });
});
