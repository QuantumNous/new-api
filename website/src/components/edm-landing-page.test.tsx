import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getEdmCampaign } from "@/lib/edm-landing";
import { EdmLandingPage } from "./edm-landing-page";

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
});
