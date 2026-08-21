import { getDirectoryCopy } from "./model-directory-copy";
import { parseDirectorySearch, type DirectorySearchParams } from "./model-directory-url";
import type { Locale } from "./locales";

// SEO policy for /models.
//
// The directory mirrors filter state into the query string, which means an
// unbounded number of URLs describe subsets of one page. Left alone that is a
// crawl-budget sink and a duplicate-content risk, so views are split in two:
//
//   · indexable — the bare directory and a single-series view
//     (/models?series=Claude). These are real landing pages people search for
//     ("Claude API pricing"), each gets its own title/description, and each
//     self-canonicalizes.
//   · noindex, canonical → /models — every other combination: multi-select,
//     price bands, context, age, free-text search, sort order. They are useful
//     to a visitor mid-session but have no independent search demand.
//
// Vendor views keep their existing behaviour: the sitemap already lists
// ?vendor=<name>, so those stay indexable and self-canonical.

export type DirectorySeo = {
  title: string;
  description: string;
  /** Canonical path, relative to the site origin and already localized. */
  canonicalQuery: string;
  noIndex: boolean;
};

const INDEXABLE_SINGLE_KEYS = ["series", "vendor"] as const;

export function buildDirectorySeo(locale: Locale, params?: DirectorySearchParams): DirectorySeo {
  const copy = getDirectoryCopy(locale);
  const parsed = parseDirectorySearch(params);

  const activeGroups = countActiveGroups(parsed);
  const hasQuery = Boolean(parsed.q?.trim());
  const hasVendor = Boolean(parsed.vendor && parsed.vendor !== "all");

  // The bare directory.
  if (activeGroups === 0 && !hasQuery && !hasVendor) {
    return { title: copy.seoTitle, description: copy.seoDescription, canonicalQuery: "", noIndex: false };
  }

  // Exactly one series, nothing else — an indexable family landing page.
  if (!hasQuery && !hasVendor && activeGroups === 1 && parsed.series.length === 1) {
    const series = parsed.series[0];
    return {
      title: copy.seoSeriesTitle.replace("{{series}}", series),
      description: copy.seoSeriesDescription.replace("{{series}}", series),
      canonicalQuery: `series=${encodeURIComponent(series)}`,
      noIndex: false,
    };
  }

  // Exactly one vendor, nothing else — already in the sitemap, keep indexable.
  if (!hasQuery && activeGroups === 0 && hasVendor && parsed.vendor) {
    return {
      title: copy.seoSeriesTitle.replace("{{series}}", parsed.vendor),
      description: copy.seoSeriesDescription.replace("{{series}}", parsed.vendor),
      canonicalQuery: `vendor=${encodeURIComponent(parsed.vendor)}`,
      noIndex: false,
    };
  }

  // One model author picked in the sidebar. Same page as ?vendor=<name>, so it
  // canonicalizes to that form rather than competing with it as a second URL.
  if (!hasQuery && !hasVendor && activeGroups === 1 && parsed.vendors.length === 1) {
    const vendor = parsed.vendors[0];
    return {
      title: copy.seoSeriesTitle.replace("{{series}}", vendor),
      description: copy.seoSeriesDescription.replace("{{series}}", vendor),
      canonicalQuery: `vendor=${encodeURIComponent(vendor)}`,
      noIndex: false,
    };
  }

  // Everything else: still renders, but points at the canonical directory.
  return { title: copy.seoTitle, description: copy.seoDescription, canonicalQuery: "", noIndex: true };
}

function countActiveGroups(parsed: ReturnType<typeof parseDirectorySearch>): number {
  const groups = [
    parsed.modalities,
    parsed.context,
    parsed.inputPrice,
    parsed.outputPrice,
    parsed.vendors,
    parsed.series,
    parsed.categories,
    parsed.age,
    parsed.distillable,
  ];
  return groups.filter((values) => values.length > 0).length;
}

export { INDEXABLE_SINGLE_KEYS };
