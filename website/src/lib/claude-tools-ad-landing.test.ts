import { describe, expect, it } from "bun:test";
import { CLAUDE_TOOLS_AD_SLUGS, getClaudeToolsAdConfigs } from "./claude-tools-ad-landing";

describe("Claude tools ad landing concepts", () => {
  it("covers all three advertising intents", () => {
    expect(CLAUDE_TOOLS_AD_SLUGS).toEqual(["web-scraping-api", "google-search-api", "apify-alternative"]);
    expect(getClaudeToolsAdConfigs()).toHaveLength(3);
  });

  it("keeps each headline aligned to its search intent", () => {
    const [scraping, search, apify] = getClaudeToolsAdConfigs();
    expect(scraping.h1.toLowerCase()).toContain("web scraping api");
    expect(search.h1.toLowerCase()).toContain("google search api");
    expect(apify.h1.toLowerCase()).toContain("simpler commercial layer");
  });

  it("does not fabricate numeric prices", () => {
    for (const config of getClaudeToolsAdConfigs()) {
      for (const row of config.pricedRows) expect(row.price).not.toMatch(/[$€£]\s*\d|\d+\.\d{2}/);
    }
  });

  it("states that Flatkey is not a replacement for every Apify Actor", () => {
    const apify = getClaudeToolsAdConfigs().find((config) => config.slug === "apify-alternative");
    expect(apify?.description).toContain("not a drop-in replacement for every Apify Actor");
    expect(apify?.caveats).toContain("Not a replacement for every Apify Actor.");
  });
});
