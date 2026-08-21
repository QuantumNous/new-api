import { describe, expect, test } from "bun:test";
import {
  ATTRIBUTION_COOKIE_SCRIPT,
  LIVECHAT_BOOTSTRAP_SCRIPT,
  ROOT_DOCUMENT_PERFORMANCE_POLICY,
  buildLanguagePreferenceSyncScript,
} from "@/components/root-document";
import { LOCALES, localeAlternates, localeLanguageTag, resolveLocaleFromPathname } from "@/lib/locales";

describe("resolveLocaleFromPathname", () => {
  test("defaults to English without a supported path locale", () => {
    expect(resolveLocaleFromPathname(undefined)).toBe("en");
    expect(resolveLocaleFromPathname("/pricing")).toBe("en");
  });

  test("uses the supported pathname locale", () => {
    expect(resolveLocaleFromPathname("/zh/pricing")).toBe("zh");
    expect(resolveLocaleFromPathname("/ja/blog/test")).toBe("ja");
  });

  test("ignores unsupported path locales", () => {
    expect(resolveLocaleFromPathname("/pricing/model")).toBe("en");
    expect(resolveLocaleFromPathname("/xx/blog")).toBe("en");
  });
});

describe("regional language metadata", () => {
  test("maps every route locale to one stable BCP47 tag", () => {
    expect(LOCALES.map(localeLanguageTag)).toEqual([
      "en-US", "zh-CN", "es-ES", "fr-FR", "pt-BR",
      "ru-RU", "ja-JP", "vi-VN", "de-DE", "id-ID",
    ]);
  });

  test("uses regional tags as hreflang keys without changing URL segments", () => {
    expect(localeAlternates("/pricing")).toMatchObject({
      "en-US": "https://flatkey.ai/pricing",
      "zh-CN": "https://flatkey.ai/zh/pricing",
      "pt-BR": "https://flatkey.ai/pt/pricing",
      "ja-JP": "https://flatkey.ai/ja/pricing",
    });
  });
});

describe("ATTRIBUTION_COOKIE_SCRIPT", () => {
  test("stores campaign parameters in a shared flatkey cookie", () => {
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("flatkey_ads_attribution");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("utm_");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("keyword:1");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("yclid");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("domain=.flatkey.ai");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("SameSite=Lax");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("first_landing_path");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("existing.landing_path");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain('path !== "/sign-in"');
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain('path !== "/sign-up"');
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain('path.indexOf("/oauth/") !== 0');
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("localStorage.setItem");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("expires_at");
  });
});

describe("RootDocument performance policy", () => {
  test("loads GTM early while keeping non-critical scripts lazy", () => {
    expect(ROOT_DOCUMENT_PERFORMANCE_POLICY.gtmStrategy).toBe("afterInteractive");
    expect(ROOT_DOCUMENT_PERFORMANCE_POLICY.livechatStrategy).toBe("lazyOnload");
  });

  test("defers livechat network work until idle or user intent", () => {
    expect(LIVECHAT_BOOTSTRAP_SCRIPT).toContain("requestIdleCallback");
    expect(LIVECHAT_BOOTSTRAP_SCRIPT).toContain("pointerdown");
    expect(LIVECHAT_BOOTSTRAP_SCRIPT).toContain("solvea-livechat-embed");
  });
});

describe("language preference sync", () => {
  test("keeps the current page locale in the shared language cookie", () => {
    expect(buildLanguagePreferenceSyncScript("en")).toContain("fk_locale=en");
    expect(buildLanguagePreferenceSyncScript("zh", ".flatkey.ai")).toContain(
      'fk_locale=zh; Path=/; Domain=.flatkey.ai; Max-Age=31536000; SameSite=Lax',
    );
    expect(buildLanguagePreferenceSyncScript("ja")).toContain("document.cookie");
  });
});
