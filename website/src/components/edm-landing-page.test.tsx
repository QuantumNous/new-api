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

  test("renders two quick-start paths for the personal AI landing page", () => {
    const html = renderToStaticMarkup(
      <EdmLandingPage campaign={getEdmCampaign("personal-ai", "ja")} locale="ja" pathname="/lp/personal-ai" />
    );

    expect(html).not.toContain("href=\"#agent-quickstart\"");
    expect(html).not.toContain("href=\"#sdk-quickstart\"");
    expect(html).not.toContain("id=\"agent-quickstart\"");
    expect(html).not.toContain("id=\"sdk-quickstart\"");
    expect(html).toContain("data-quickstart-target=\"agent\"");
    expect(html).toContain("data-quickstart-target=\"sdk\"");
    expect(html).toContain("underline decoration-violet-300 underline-offset-4");
    expect(html).toContain("!grid");
    expect(html).toContain("Codex / Claude Code を設定");
    expect(html).toContain("SDK サンプルをコピー");
    expect(html).toContain("30秒でセットアップ完了");
    expect(html).not.toContain("Quick Start");
    expect(html).toContain("使い方");
    expect(html).not.toContain("Tutorial");
    expect(html).toContain("curl");
    expect(html).toContain("Python");
    expect(html).toContain("Node.js");
  });
});
