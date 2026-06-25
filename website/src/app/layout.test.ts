import { describe, expect, test } from "bun:test";
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
