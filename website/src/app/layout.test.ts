import { describe, expect, test } from "bun:test";
import { resolveHtmlLang } from "./layout";

describe("resolveHtmlLang", () => {
  test("defaults to English without a supported locale", () => {
    expect(resolveHtmlLang(undefined)).toBe("en");
    expect(resolveHtmlLang("pricing")).toBe("en");
  });

  test("uses the supported locale directly", () => {
    expect(resolveHtmlLang("es")).toBe("es");
    expect(resolveHtmlLang("fr")).toBe("fr");
    expect(resolveHtmlLang("ja")).toBe("ja");
  });
});
