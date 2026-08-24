import { describe, expect, test } from "bun:test";
import { cliLandingCopy } from "@/lib/cli-landing";
import { LOCALES } from "@/lib/locales";

const ENGLISH_MEDIA_STRINGS = [
  "Real media jobs",
  "Use the CLI to produce files, not just prompts",
  "9:16 UGC ad clips",
  "Campaign hero images",
  "Product reveal sequences",
  "Thumbnail test sets",
  "Localized market variants",
  "Storyboard to motion",
];

describe("CLI landing localization", () => {
  test("every locale provides complete media example copy", () => {
    for (const locale of LOCALES) {
      const media = cliLandingCopy[locale].sections.media;

      expect(media.eyebrow.length).toBeGreaterThan(0);
      expect(media.title.length).toBeGreaterThan(0);
      expect(media.body.length).toBeGreaterThan(0);
      expect(media.items).toHaveLength(6);
      for (const item of media.items) {
        expect(item.kind.length).toBeGreaterThan(0);
        expect(item.title.length).toBeGreaterThan(0);
        expect(item.body.length).toBeGreaterThan(0);
        expect(item.outcome.length).toBeGreaterThan(0);
      }
    }
  });

  test("localized media sections do not fall back to the English copy", () => {
    for (const locale of LOCALES.filter((value) => value !== "en")) {
      const serialized = JSON.stringify(cliLandingCopy[locale].sections.media);

      for (const english of ENGLISH_MEDIA_STRINGS) {
        expect(serialized).not.toContain(english);
      }
    }
  });

  test("Indonesian has reviewed CLI copy instead of the English fallback", () => {
    const english = cliLandingCopy.en;
    const indonesian = cliLandingCopy.id;

    expect(indonesian).not.toBe(english);
    expect(indonesian.seo.title).toContain("tim media AI");
    expect(indonesian.hero.title).toContain("CLI");
    expect(indonesian.hero.title).not.toBe(english.hero.title);
    expect(indonesian.sections.workflow.title).not.toBe(english.sections.workflow.title);
  });
});
