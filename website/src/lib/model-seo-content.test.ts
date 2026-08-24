import { describe, expect, test } from "bun:test";
import { LOCALES } from "./locales";
import { buildModelFaq, buildModelIntro } from "./model-seo-content";

const input = {
  modelName: "deepseek-v4-flash",
  vendorName: "DeepSeek",
  kind: "chat" as const,
  isTokenBilled: true,
  savingsPct: 47,
  inputList: "$0.14",
  inputDiscounted: "$0.074667",
  outputDiscounted: "$0.149333",
  routerBaseUrl: "https://router.example.test/v1",
  comparison: [],
};

describe("model SEO coverage claims", () => {
  test("uses the current public 40+ model inventory in every locale", () => {
    for (const locale of LOCALES) {
      const copy = [buildModelIntro(input, locale), ...buildModelFaq(input, locale).map((item) => item.a)].join(" ");
      expect(copy).not.toContain("500+");
      expect(copy).toContain("40+");
    }
  });
});
