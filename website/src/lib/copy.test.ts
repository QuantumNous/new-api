import { describe, expect, test } from "bun:test";
import { getCopy } from "./copy";
import { LOCALES } from "./locales";

describe("homepage copy", () => {
  test("provides localized homepage sections for every supported locale", () => {
    const english = getCopy("en").home;

    for (const locale of LOCALES) {
      const home = getCopy(locale).home;

      expect(home.hero.badge).toBeTruthy();
      expect(home.features.items).toHaveLength(3);
      expect(home.about.items).toHaveLength(3);
      expect(home.productHighlights.items).toHaveLength(4);
      expect(home.howItWorks.steps).toHaveLength(3);
      expect(home.stats.items).toHaveLength(4);

      if (locale !== "en") {
        expect(home.hero.badge).not.toBe(english.hero.badge);
        expect(home.features.items[0]?.title).not.toBe(english.features.items[0]?.title);
      }
    }
  });
});

describe("blog copy", () => {
  test("provides localized blog chrome for every supported locale", () => {
    const english = getCopy("en").blog;

    for (const locale of LOCALES) {
      const blog = getCopy(locale).blog;

      expect(blog.title).toBeTruthy();
      expect(blog.description).toBeTruthy();
      expect(blog.searchPlaceholder).toBeTruthy();
      expect(blog.pageOf).toContain("{{page}}");
      expect(blog.pageOf).toContain("{{total}}");
      expect(blog.latestInCategory).toContain("{{category}}");
      expect(blog.categoryTitle).toContain("{{category}}");

      if (locale !== "en") {
        expect(blog.searchPlaceholder).not.toBe(english.searchPlaceholder);
        expect(blog.emptyTitle).not.toBe(english.emptyTitle);
      }
    }
  });
});
