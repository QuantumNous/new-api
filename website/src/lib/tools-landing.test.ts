import { describe, expect, test } from "bun:test";
import { LOCALES } from "./locales";
import {
  getLocalizedToolsPath,
  getToolsLandingMetadataInput,
  getToolsMarketplaceUrl,
  getToolsSignupUrl,
  TOOLS_LANDING_PATH,
  TOOLS_SETUP_COMMAND,
  toolsLandingCopy,
} from "./tools-landing";

describe("tools landing", () => {
  test("ships complete copy and metadata for every locale", () => {
    for (const locale of LOCALES) {
      const copy = toolsLandingCopy[locale];
      expect(copy.metaTitle.length).toBeGreaterThan(20);
      expect(copy.metaDescription.length).toBeGreaterThan(60);
      expect(copy.categories).toHaveLength(8);
      expect(copy.steps).toHaveLength(3);
      expect(copy.stats).toHaveLength(4);
      expect(copy.methods).toHaveLength(3);
      expect(copy.faqs).toHaveLength(5);
      expect(getToolsLandingMetadataInput(locale)).toMatchObject({ pathname: TOOLS_LANDING_PATH, locale });
    }
  });

  test("localizes the public page and keeps console CTAs tenant-safe", () => {
    expect(getLocalizedToolsPath("en")).toBe("/tools");
    expect(getLocalizedToolsPath("zh")).toBe("/zh/tools");
    expect(getToolsMarketplaceUrl("de")).toContain("/api-marketplace?lng=de");
    expect(getToolsSignupUrl("ja")).toContain("redirect=%2Fapi-marketplace");
  });

  test("points agents at the public Flatkey skill", () => {
    expect(TOOLS_SETUP_COMMAND).toBe("Set up Flatkey from https://flatkey.ai/SKILL.md");
  });
});
