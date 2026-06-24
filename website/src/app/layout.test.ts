import { describe, expect, test } from "bun:test";
import { ATTRIBUTION_COOKIE_SCRIPT, resolveHtmlLang } from "./layout";

describe("resolveHtmlLang", () => {
  test("defaults to English without a supported locale", () => {
    expect(resolveHtmlLang(undefined)).toBe("en");
    expect(resolveHtmlLang("pricing")).toBe("en");
  });

  test("falls back to the pathname locale when available", () => {
    expect(resolveHtmlLang(undefined, "/zh/pricing")).toBe("zh");
    expect(resolveHtmlLang(null, "/ja/blog/test")).toBe("ja");
  });

  test("uses the supported locale directly", () => {
    expect(resolveHtmlLang("es")).toBe("es");
    expect(resolveHtmlLang("fr")).toBe("fr");
    expect(resolveHtmlLang("ja")).toBe("ja");
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
