import { describe, expect, test } from "bun:test";
import { resolveHtmlLangFromPathname } from "./layout";

describe("resolveHtmlLangFromPathname", () => {
  test("defaults to English without a locale prefix", () => {
    expect(resolveHtmlLangFromPathname("/")).toBe("en");
    expect(resolveHtmlLangFromPathname("/pricing")).toBe("en");
  });

  test("uses the locale prefix when it is supported", () => {
    expect(resolveHtmlLangFromPathname("/es")).toBe("es");
    expect(resolveHtmlLangFromPathname("/fr/pricing")).toBe("fr");
    expect(resolveHtmlLangFromPathname("/ja/models/gpt-api")).toBe("ja");
  });
});
