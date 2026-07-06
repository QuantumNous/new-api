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
    expect(campaign.badge).toBe("登録無料・まずAPIキーを発行");
    expect(campaign.hero.title).toBe("個人開発者向け、AI APIコストを40%削減");
    expect(campaign.hero.description).toContain("CodexやClaude Code");
    expect(campaign.hero.description).toContain("自分のソフトウェアにもAI機能");
    expect(campaign.hero.description).toContain("テキスト・音声・動画・画像モデル");
    expect(campaign.hero.highlight).toBe("登録無料。APIキー作成後、チャージは実際に使う段階で可能です。");
    expect(campaign.primaryCta).toBe("無料でAPIキーを作成");
    expect(campaign.ctaNote).toBe("登録後、そのままAPIキーページへ移動します。");
    expect(campaign.quickStart?.body).toContain("base_urlとAPIキー");
    expect(campaign.quickStart?.agentAction).toBe("Codex / Claude Code を設定");
    expect(campaign.quickStart?.sdkAction).toBe("SDK サンプルをコピー");
    expect(campaign.offer?.title).toBe("接続方法を選んで、すぐ試す");
    expect(campaign.offer?.body).toContain("一行コマンド");
    expect(campaign.offer?.body).toContain("base_url");
    expect(campaign.heroPanel?.kicker).toBe("次にやること");
    expect(campaign.heroPanel?.title).toBe("接続方法を選んで、すぐ試す");
    expect(campaign.heroPanel?.footnote).toBe("Codex / Claude Codeなら一行コマンド、SDKならbase_urlを差し替えるだけです。");
    expect(campaign.sectionLabels.startTitle).toBe("3ステップで利用開始");
    expect(campaign.steps[0]?.title).toBe("無料登録");
    expect(campaign.steps[1]?.title).toBe("接続方法を選択");
    expect(campaign.steps[1]?.body).not.toContain("APIキーを作成");
    expect(campaign.steps[2]?.title).toBe("AIモデルを利用開始");
    expect(campaign.heroPanel?.rows[1]?.value).toBe("無料APIキー");
    expect(campaign.heroPanel?.rows[2]?.value).toBe("1つのAPIキーで一括利用");
    expect(campaign.proof.body).toContain("100億トークンの利用実績");
    expect(campaign.faqs[1]?.answer).toContain("自分のプロダクト");

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
