import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getToolsAdLandingConfig } from "@/lib/tools-ad-landing";
import { ToolsAdLandingPage } from "./tools-ad-landing-page";

describe("ToolsAdLandingPage", () => {
  test("renders the scraping intent, bounded example, and conversion CTA", () => {
    const html = renderToStaticMarkup(<ToolsAdLandingPage config={getToolsAdLandingConfig("web-scraping-api")} />);
    expect(html).toContain("Web Scraping API");
    expect(html).toContain("Execution receipt");
    expect(html).toContain("Browse scraping tools");
  });

  test("renders search evidence and source-preservation language", () => {
    const html = renderToStaticMarkup(<ToolsAdLandingPage config={getToolsAdLandingConfig("google-search-api")} />);
    expect(html).toContain("Google Search API");
    expect(html).toContain("Source URLs preserved");
    expect(html).toContain("Browse search tools");
  });
});
