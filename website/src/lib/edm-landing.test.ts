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

  test("uses polished Japanese SaaS copy for the personal AI landing page", () => {
    const campaign = getEdmCampaign("personal-ai", "ja");
    const copy = [
      campaign.eyebrow,
      campaign.badge,
      campaign.hero.title,
      campaign.hero.accent,
      campaign.hero.description,
      campaign.hero.highlight ?? "",
      campaign.offer.title,
      campaign.offer.body,
      campaign.primaryCta,
      campaign.proof.title,
      campaign.proof.body,
      campaign.finalTitle,
      campaign.finalBody,
      campaign.heroPanel?.kicker ?? "",
      campaign.heroPanel?.title ?? "",
      campaign.heroPanel?.footnote ?? "",
      ...(campaign.heroPanel?.rows.flatMap((item) => [item.label, item.value, item.body]) ?? []),
      ...campaign.evidence.flatMap((item) => [item.title, item.body]),
      ...campaign.steps.flatMap((item) => [item.title, item.body]),
      ...campaign.faqs.flatMap((item) => [item.question, item.answer]),
    ].join("\n");

    expect(campaign.eyebrow).toBe("個人向けAI利用コスト削減");
    expect(campaign.badge).toBe("20ドルチャージで5ドルボーナス付与");
    expect(campaign.heroPanel?.rows[1]?.value).toBe("20ドルチャージで5ドルボーナス");
    expect(campaign.heroPanel?.rows[2]?.value).toBe("1つのAPIキーで一括利用");
    expect(campaign.proof.body).toContain("100億トークンの利用実績");
    expect(campaign.faqs[1]?.answer).toContain("各社公式の上流トークン");

    expect(copy).not.toMatch(/\b(?:token|tokens|upstream|routing|provider|workflow|prompt|key)\b/i);
    expect(copy).not.toContain("3x");
    expect(copy).not.toContain("$20");
    expect(copy).not.toContain("$5");
    expect(copy).not.toContain("10 billion");
  });
});

describe("robots", () => {
  test("disallows EDM landing pages", () => {
    const route = robots();
    expect(route.rules[0].disallow).toContain("/lp/");
  });
});
