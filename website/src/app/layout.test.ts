import { describe, expect, test } from "bun:test";
import {
  ATTRIBUTION_COOKIE_SCRIPT,
  LIVECHAT_BOOTSTRAP_SCRIPT,
  ROOT_DOCUMENT_PERFORMANCE_POLICY,
} from "@/components/root-document";
import { resolveLocaleFromPathname } from "@/lib/locales";

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

describe("ATTRIBUTION_COOKIE_SCRIPT", () => {
  test("stores campaign parameters in a shared flatkey cookie", () => {
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("flatkey_ads_attribution");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("utm_");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("yclid");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("domain=.flatkey.ai");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("SameSite=Lax");
  });
});

describe("RootDocument performance policy", () => {
  test("loads GTM early while keeping non-critical scripts lazy", () => {
    expect(ROOT_DOCUMENT_PERFORMANCE_POLICY.gtmStrategy).toBe("afterInteractive");
    expect(ROOT_DOCUMENT_PERFORMANCE_POLICY.livechatStrategy).toBe("lazyOnload");
    expect(ROOT_DOCUMENT_PERFORMANCE_POLICY.mixpanelStrategy).toBe("lazyOnload");
  });

  test("defers livechat network work until idle or user intent", () => {
    expect(LIVECHAT_BOOTSTRAP_SCRIPT).toContain("requestIdleCallback");
    expect(LIVECHAT_BOOTSTRAP_SCRIPT).toContain("pointerdown");
    expect(LIVECHAT_BOOTSTRAP_SCRIPT).toContain("solvea-livechat-embed");
  });
});
