import { describe, expect, test } from "bun:test";
import { LOCALES } from "./locales";
import { buildDirectorySeo } from "./model-directory-seo";
import { DIRECTORY_COPY } from "./model-directory-copy";

// The directory writes filter state into the query string, so an unbounded set
// of URLs describes subsets of one page. These tests pin the indexing policy:
// only the bare directory and single series/vendor views are indexable, and
// everything else canonicalizes back to /models.

describe("directory SEO policy", () => {
  test("the bare directory is indexable and self-canonical", () => {
    const seo = buildDirectorySeo("en");
    expect(seo.noIndex).toBe(false);
    expect(seo.canonicalQuery).toBe("");
    expect(seo.title).toBe(DIRECTORY_COPY.en.seoTitle);
  });

  test("a single series is an indexable landing page with its own title", () => {
    const seo = buildDirectorySeo("en", { series: "Claude" });
    expect(seo.noIndex).toBe(false);
    expect(seo.canonicalQuery).toBe("series=Claude");
    expect(seo.title).toContain("Claude");
    expect(seo.description).toContain("Claude");
    expect(seo.title).not.toContain("{{series}}");
  });

  test("a single vendor stays indexable because the sitemap lists it", () => {
    const seo = buildDirectorySeo("en", { vendor: "OpenAI" });
    expect(seo.noIndex).toBe(false);
    expect(seo.canonicalQuery).toBe("vendor=OpenAI");
    expect(seo.title).toContain("OpenAI");
  });

  test("one model author from the sidebar canonicalizes to the ?vendor= form", () => {
    const seo = buildDirectorySeo("en", { vendors: "Anthropic" });
    expect(seo.noIndex).toBe(false);
    // Same page as ?vendor=Anthropic, so it must not compete as a second URL.
    expect(seo.canonicalQuery).toBe("vendor=Anthropic");
    expect(seo.title).toContain("Anthropic");
  });

  test("several model authors are noindex like any multi-select", () => {
    const seo = buildDirectorySeo("en", { vendors: "OpenAI,Anthropic" });
    expect(seo.noIndex).toBe(true);
    expect(seo.canonicalQuery).toBe("");
  });

  test("multi-select and cross-group combinations are noindex", () => {
    for (const params of [
      { series: "Claude,GPT" },
      { series: "Claude", context: "1048576" },
      { modalities: "image" },
      { inputPrice: "lt-0.5" },
      { age: "new" },
      { distillable: "true" },
      { series: "Claude", vendor: "Anthropic" },
    ]) {
      const seo = buildDirectorySeo("en", params);
      expect(seo.noIndex, `${JSON.stringify(params)} should be noindex`).toBe(true);
      expect(seo.canonicalQuery).toBe("");
    }
  });

  test("a free-text search is noindex even with no filters", () => {
    const seo = buildDirectorySeo("en", { q: "cheap vision model" });
    expect(seo.noIndex).toBe(true);
    expect(seo.canonicalQuery).toBe("");
  });

  test("sort order alone does not create a separate indexable URL", () => {
    const seo = buildDirectorySeo("en", { sort: "newest" });
    expect(seo.canonicalQuery).toBe("");
    expect(seo.noIndex).toBe(false);
  });

  test("unknown filter values are ignored rather than making a page noindex", () => {
    const seo = buildDirectorySeo("en", { modalities: "telepathy" });
    expect(seo.noIndex).toBe(false);
    expect(seo.canonicalQuery).toBe("");
  });

  test("series values are URL-encoded in the canonical", () => {
    expect(buildDirectorySeo("en", { series: "Nano Banana" }).canonicalQuery).toBe("series=Nano%20Banana");
  });

  test("every locale returns translated, placeholder-free SEO copy", () => {
    for (const locale of LOCALES) {
      const bare = buildDirectorySeo(locale);
      expect(bare.title.trim(), `${locale} title`).not.toBe("");
      expect(bare.description.trim(), `${locale} description`).not.toBe("");

      const series = buildDirectorySeo(locale, { series: "Claude" });
      expect(series.title, `${locale} series title`).not.toContain("{{series}}");
      expect(series.description, `${locale} series description`).not.toContain("{{series}}");
      expect(series.title, `${locale} series title`).toContain("Claude");
    }
  });
});
