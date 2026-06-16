import { describe, expect, test } from "bun:test";
import { getPageContent } from "./pages";

describe("localized public page metadata", () => {
  test("uses localized titles and descriptions for legal and pricing pages", () => {
    expect(getPageContent("pricing", "zh").title).not.toBe(getPageContent("pricing", "en").title);
    expect(getPageContent("pricing", "zh").description).not.toBe(getPageContent("pricing", "en").description);
    expect(getPageContent("terms", "es").title).not.toBe(getPageContent("terms", "en").title);
    expect(getPageContent("terms", "es").description).not.toBe(getPageContent("terms", "en").description);
    expect(getPageContent("privacy", "ja").description).not.toBe(getPageContent("privacy", "en").description);
    expect(getPageContent("refund-policy", "fr").description).not.toBe(getPageContent("refund-policy", "en").description);
  });
});
