import { describe, expect, test } from "bun:test";
import {
  TOOLS_AD_LANDING_SLUGS,
  getToolsAdLandingConfig,
  getToolsAdLandingMetadataInput,
  getToolsAdLandingPathnames,
  getToolsAdMarketplaceUrl,
} from "./tools-ad-landing";

describe("tools ad landing config", () => {
  test("maps one paid-search intent to each landing page", () => {
    expect(getToolsAdLandingPathnames()).toEqual(["/tools/web-scraping-api", "/tools/google-search-api"]);
    for (const slug of TOOLS_AD_LANDING_SLUGS) {
      const config = getToolsAdLandingConfig(slug);
      expect(config.h1.toLowerCase()).toContain(config.keyword);
      expect(config.receiptRows).toHaveLength(3);
      expect(config.benefits).toHaveLength(4);
      expect(config.faqs).toHaveLength(3);
      expect(getToolsAdMarketplaceUrl(slug)).toContain("/api-marketplace");
    }
  });

  test("keeps English-only ad metadata on the canonical route", () => {
    for (const slug of TOOLS_AD_LANDING_SLUGS) {
      const input = getToolsAdLandingMetadataInput(slug);
      expect(input.pathname).toBe(`/tools/${slug}`);
      expect(input.locales).toEqual(["en"]);
    }
  });
});
