import { describe, expect, test } from "bun:test";
import { LOCALES } from "./locales";
import {
  AGE_BAND_LABELS,
  CATEGORY_LABELS,
  DIRECTORY_COPY,
  MODALITY_LABELS,
  SORT_LABELS,
  categoryLabel,
  formatCount,
  getDirectoryCopy,
} from "./model-directory-copy";
import { AGE_BANDS, MODALITIES } from "./model-directory-meta";
import { DIRECTORY_SORTS } from "./model-directory-filters";

// The directory ships user-facing strings in ten locales. These tests guard the
// two failure modes the type system cannot catch: a key that exists but is
// empty, and a "translation" that is just the English string copied across.

const BRAND_AND_LITERAL = new Set(["SEO", "Marketing", "Audio", "Video", "Filter", "Text", "API"]);

describe("directory copy", () => {
  test("every locale defines every key with a non-empty value", () => {
    const englishKeys = Object.keys(DIRECTORY_COPY.en);
    for (const locale of LOCALES) {
      const copy = DIRECTORY_COPY[locale];
      expect(Object.keys(copy).sort(), `${locale} keys`).toEqual(englishKeys.sort());
      for (const [key, value] of Object.entries(copy)) {
        expect(value.trim(), `${locale}.${key} is empty`).not.toBe("");
      }
    }
  });

  test("non-English locales are actually translated, not English copies", () => {
    for (const locale of LOCALES) {
      if (locale === "en") continue;
      const copy = DIRECTORY_COPY[locale];
      const identical = Object.entries(copy).filter(
        ([key, value]) => value === DIRECTORY_COPY.en[key as keyof typeof copy] && !BRAND_AND_LITERAL.has(value)
      );
      // A handful of terms legitimately match English (loanwords like "Filter"
      // in German or "Marketing" nearly everywhere); a wholesale copy does not.
      expect(identical.length, `${locale} reuses English for: ${identical.map(([key]) => key).join(", ")}`).toBeLessThan(6);
    }
  });

  test("modality, age, and sort labels cover every locale and value", () => {
    for (const locale of LOCALES) {
      for (const modality of MODALITIES) {
        expect(MODALITY_LABELS[locale][modality]?.trim(), `${locale}.${modality}`).toBeTruthy();
      }
      for (const band of AGE_BANDS) {
        expect(AGE_BAND_LABELS[locale][band]?.trim(), `${locale}.${band}`).toBeTruthy();
      }
      for (const sort of DIRECTORY_SORTS) {
        expect(SORT_LABELS[locale][sort]?.trim(), `${locale}.${sort}`).toBeTruthy();
      }
    }
  });

  test("every locale but English translates the use-case categories", () => {
    const categories = Object.keys(CATEGORY_LABELS.zh);
    for (const locale of LOCALES) {
      if (locale === "en") continue;
      for (const category of categories) {
        expect(CATEGORY_LABELS[locale][category]?.trim(), `${locale}.${category}`).toBeTruthy();
      }
    }
  });

  test("an unmapped category falls back to its readable key", () => {
    expect(categoryLabel("zh", "Programming")).toBe("编程");
    expect(categoryLabel("zh", "Robotics")).toBe("Robotics");
    expect(categoryLabel("en", "Programming")).toBe("Programming");
  });

  test("count interpolation uses locale-formatted numbers", () => {
    expect(formatCount(DIRECTORY_COPY.en.modelsFound, 1234)).toBe("1,234 models found");
    expect(formatCount(DIRECTORY_COPY.zh.modelsFound, 95)).toBe("找到 95 个模型");
  });

  test("getDirectoryCopy returns the locale's own table", () => {
    expect(getDirectoryCopy("ja").filter).toBe("絞り込み");
    expect(getDirectoryCopy("en").filter).toBe("Filter");
  });
});
