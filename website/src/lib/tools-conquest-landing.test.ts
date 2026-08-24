import { describe, expect, test } from "bun:test";
import {
  APIFY_ALTERNATIVE_KEYWORD,
  APIFY_ALTERNATIVE_PATH,
  APIFY_ALTERNATIVE_SETUP_COMMAND,
  apifyAlternativeCopy,
  getApifyAlternativeMarketplaceUrl,
  getApifyAlternativeMetadataInput,
  getApifyAlternativeSignupUrl,
} from "./tools-conquest-landing";

describe("Apify alternative paid-search landing", () => {
  test("echoes the exact ad-group keyword in the H1", () => {
    expect(`${apifyAlternativeCopy.h1Lead} ${apifyAlternativeCopy.h1Accent}`.toLowerCase()).toBe(APIFY_ALTERNATIVE_KEYWORD);
  });

  test("is English-only and canonicalizes to the live route", () => {
    expect(getApifyAlternativeMetadataInput()).toMatchObject({
      pathname: APIFY_ALTERNATIVE_PATH,
      locale: "en",
      locales: ["en"],
    });
  });

  test("keeps conversion CTAs on the environment-driven console origin", () => {
    expect(getApifyAlternativeMarketplaceUrl()).toContain("/api-marketplace?lng=en");
    expect(getApifyAlternativeSignupUrl()).toContain("/sign-up?redirect=%2Fapi-marketplace&lng=en");
  });

  test("ships comparison evidence, migration steps, and a public skill command", () => {
    expect(apifyAlternativeCopy.comparisonRows).toHaveLength(5);
    expect(apifyAlternativeCopy.sourceLinks).toHaveLength(2);
    expect(apifyAlternativeCopy.migrationSteps).toHaveLength(4);
    expect(apifyAlternativeCopy.faqs).toHaveLength(5);
    expect(APIFY_ALTERNATIVE_SETUP_COMMAND).toContain("/SKILL.md");
  });
});
