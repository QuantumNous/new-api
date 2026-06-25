import { describe, expect, test } from "bun:test";
import robots from "@/app/robots";
import { LOCALES } from "@/lib/locales";
import {
  EDM_CAMPAIGN_IDS,
  EDM_LANDING_PATHS,
  getEdmCampaign,
  getEdmCtaUrl,
  getEdmMetadataInput,
} from "./edm-landing";

describe("EDM landing campaigns", () => {
  test("defines the three approved campaign paths", () => {
    expect(EDM_CAMPAIGN_IDS).toEqual(["personal-ai", "cto-ai-savings", "image-buddy"]);
    expect(EDM_LANDING_PATHS).toEqual({
      "personal-ai": "/lp/personal-ai",
      "cto-ai-savings": "/lp/cto-ai-savings",
      "image-buddy": "/lp/image-buddy",
    });
  });

  test("has complete localized copy for every supported website locale", () => {
    for (const locale of LOCALES) {
      for (const campaignId of EDM_CAMPAIGN_IDS) {
        const campaign = getEdmCampaign(campaignId, locale);
        expect(campaign.hero.title.length).toBeGreaterThan(12);
        expect(campaign.hero.description.length).toBeGreaterThan(40);
        expect(campaign.evidence).toHaveLength(3);
        expect(campaign.steps).toHaveLength(3);
        expect(campaign.faqs).toHaveLength(3);
      }
    }
  });

  test("builds the CTA from the configured console origin", () => {
    expect(getEdmCtaUrl("https://console.example.test")).toBe(
      "https://console.example.test/sign-up?redirect=/keys"
    );
  });

  test("marks campaign metadata as noindex and nofollow", () => {
    const input = getEdmMetadataInput("personal-ai", "en");
    expect(input.pathname).toBe("/lp/personal-ai");
    expect(input.noIndex).toBe(true);
    expect(input.title).toContain("40%");
  });
});

describe("robots", () => {
  test("disallows EDM landing pages", () => {
    const route = robots();
    expect(route.rules[0].disallow).toContain("/lp/");
  });
});
