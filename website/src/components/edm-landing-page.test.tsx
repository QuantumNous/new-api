import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { getEdmCampaign } from "@/lib/edm-landing";
import { EdmLandingPage, shouldRenderLandingOfferModal } from "./edm-landing-page";

describe("EdmLandingPage", () => {
  test("keeps the Japanese personal AI landing hero compact on mobile", () => {
    const html = renderToStaticMarkup(
      <EdmLandingPage campaign={getEdmCampaign("personal-ai", "ja")} locale="ja" pathname="/lp/personal-ai" />
    );

    expect(html).toContain("text-[2.25rem]");
    expect(html).toContain("max-[420px]:text-[2rem]");
    expect(html).toContain("max-[420px]:leading-6");
    expect(html).toContain("max-[420px]:grid-cols-1");
  });

  test("scopes the Japanese landing page to the Gothic font stack", () => {
    const jaHtml = renderToStaticMarkup(
      <EdmLandingPage campaign={getEdmCampaign("personal-ai", "ja")} locale="ja" pathname="/lp/personal-ai" />
    );
    const enHtml = renderToStaticMarkup(
      <EdmLandingPage campaign={getEdmCampaign("personal-ai", "en")} locale="en" pathname="/lp/personal-ai" />
    );

    expect(jaHtml).toContain("ja-gothic-landing");
    expect(enHtml).not.toContain("ja-gothic-landing");

    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(".ja-gothic-landing");
    expect(css).toContain("\"Noto Sans JP\"");
    expect(css).toContain("\"Hiragino Kaku Gothic ProN\"");
    expect(css).toContain("\"Yu Gothic\"");
  });

  test("hides the limited offer modal on Japanese landing pages only", () => {
    expect(shouldRenderLandingOfferModal("ja")).toBe(false);
    expect(shouldRenderLandingOfferModal("en")).toBe(true);
    expect(shouldRenderLandingOfferModal("zh")).toBe(true);
  });
});
