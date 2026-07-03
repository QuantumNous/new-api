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

  test("uses key signup and pricing calls to action", () => {
    expect(getCopy("en").home.primary).toBe("Get a key");
    expect(getCopy("en").home.secondary).toBe("View Pricing");

    for (const locale of LOCALES) {
      const home = getCopy(locale).home;

      expect(home.primary).toBeTruthy();
      expect(home.secondary).toBeTruthy();
      expect(home.primary).not.toBe(home.secondary);
      expect(home.secondary.toLowerCase()).not.toContain("blog");
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

describe("footer copy", () => {
  test("uses the security reliability and price slogan in every locale", () => {
    expect(getCopy("en").footer.tagline).toBe("Secure, reliable, affordable");
    expect(getCopy("zh").footer.tagline).toBe("安全、可靠、便宜");
    expect(getCopy("es").footer.tagline).toBe("Seguro, fiable y asequible");
    expect(getCopy("fr").footer.tagline).toBe("Securise, fiable et abordable");
    expect(getCopy("pt").footer.tagline).toBe("Seguro, confiavel e acessivel");
    expect(getCopy("ru").footer.tagline).toBe("Безопасно, надежно и доступно");
    expect(getCopy("ja").footer.tagline).toBe("安全、信頼、低価格");
    expect(getCopy("vi").footer.tagline).toBe("An toàn, đáng tin cậy, giá tốt");
    expect(getCopy("de").footer.tagline).toBe("Sicher, zuverlässig und günstig");
  });
});
