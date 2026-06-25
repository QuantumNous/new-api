import { describe, expect, test } from "bun:test";
import { ATTRIBUTION_COOKIE_SCRIPT } from "@/components/root-document";
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
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("domain=.flatkey.ai");
    expect(ATTRIBUTION_COOKIE_SCRIPT).toContain("SameSite=Lax");
  });
});
