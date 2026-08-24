import { localizePath, type Locale } from "./locales";
import {
  DIRECTORY_FILTER_KEYS,
  EMPTY_DIRECTORY_FILTERS,
  type DirectoryFilterKey,
  type DirectoryFilters,
  type DirectorySort,
} from "./model-directory-filters";
import { AGE_BANDS, CONTEXT_BUCKETS, MODALITIES, PRICE_BANDS, type AgeBand, type Modality, type PriceBandId } from "./model-directory-meta";

// Filter state is mirrored into the query string so reloads and shared links
// restore the exact view — which also gives search engines crawlable entry
// points into individual slices of the directory.
//
//   /models?series=Claude,GPT&modalities=image&context=1048576&sort=newest
//
// Unknown or malformed values are dropped rather than throwing, so a
// hand-edited URL degrades to a wider result set instead of an error page.

const DEFAULT_SORT: DirectorySort = "rank";

const VALID_SORTS = new Set<string>(["rank", "newest", "discount", "ctxDesc", "name"]);
const VALID_MODALITIES = new Set<string>(MODALITIES);
const VALID_CONTEXT = new Set<number>(CONTEXT_BUCKETS);
const VALID_PRICE_BANDS = new Set<string>(PRICE_BANDS.map((band) => band.id));
const VALID_AGE_BANDS = new Set<string>(AGE_BANDS);
const SINGLE_SELECT_FILTER_KEYS = new Set<DirectoryFilterKey>(["context", "distillable"]);

export type DirectorySearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function splitValues(value: string | string[] | undefined): string[] {
  const rawValues = Array.isArray(value) ? value : value == null ? [] : [value];
  const values = rawValues.flatMap((raw) =>
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
  return [...new Set(values)];
}

export function parseDirectorySearch(params?: DirectorySearchParams): DirectoryFilters & { sort: DirectorySort } {
  const sortParam = firstValue(params?.sort);
  return {
    ...EMPTY_DIRECTORY_FILTERS,
    modalities: splitValues(params?.modalities).filter((value): value is Modality => VALID_MODALITIES.has(value)),
    context: splitValues(params?.context)
      .map((value) => Number(value))
      .filter((value) => VALID_CONTEXT.has(value))
      .slice(0, 1),
    inputPrice: splitValues(params?.inputPrice).filter((value): value is PriceBandId => VALID_PRICE_BANDS.has(value)),
    outputPrice: splitValues(params?.outputPrice).filter((value): value is PriceBandId => VALID_PRICE_BANDS.has(value)),
    vendors: splitValues(params?.vendors),
    providers: splitValues(params?.providers),
    series: splitValues(params?.series),
    categories: splitValues(params?.categories),
    age: splitValues(params?.age).filter((value): value is AgeBand => VALID_AGE_BANDS.has(value)),
    distillable: splitValues(params?.distillable)
      .filter((value) => value === "true" || value === "false")
      .map((value) => value === "true")
      .slice(0, 1),
    q: firstValue(params?.q),
    vendor: firstValue(params?.vendor),
    sort: sortParam && VALID_SORTS.has(sortParam) ? (sortParam as DirectorySort) : DEFAULT_SORT,
  };
}

export function directorySearchQuery(filters: DirectoryFilters, sort: DirectorySort = DEFAULT_SORT): string {
  const params = new URLSearchParams();
  for (const key of DIRECTORY_FILTER_KEYS) {
    const values = filters[key] as Array<string | number | boolean>;
    if (values.length > 0) params.set(key, values.map(String).join(","));
  }
  const query = filters.q?.trim();
  if (query) params.set("q", query);
  if (filters.vendor && filters.vendor !== "all") params.set("vendor", filters.vendor);
  if (sort !== DEFAULT_SORT) params.set("sort", sort);
  return params.toString();
}

export function directoryHref(locale: Locale, filters: DirectoryFilters, sort: DirectorySort = DEFAULT_SORT): string {
  const query = directorySearchQuery(filters, sort);
  return `${localizePath("/models", locale)}${query ? `?${query}` : ""}`;
}

/** Toggle one value inside a group, returning a new filter object. */
export function toggleDirectoryFilter<K extends (typeof DIRECTORY_FILTER_KEYS)[number]>(
  filters: DirectoryFilters,
  key: K,
  value: DirectoryFilters[K][number]
): DirectoryFilters {
  const current = filters[key] as Array<DirectoryFilters[K][number]>;
  let next: Array<DirectoryFilters[K][number]>;
  if (SINGLE_SELECT_FILTER_KEYS.has(key)) {
    next = current.includes(value) ? [] : [value];
  } else {
    next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  }
  return { ...filters, [key]: next };
}
