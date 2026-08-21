import {
  ageBandFor,
  getModelMeta,
  inferSeries,
  priceBandFor,
  type AgeBand,
  type Modality,
  type PriceBandId,
} from "./model-directory-meta";

// Filter engine for the /models directory. Mirrors the prototype's semantics:
//
//   · within a group  = OR   (picking GPT and Claude shows both families)
//   · across groups   = AND  (series=GPT AND modality=image must both hold)
//   · a facet count is how many models would remain if that option were also
//     ticked, ignoring the other selections in its own group — so sibling
//     options never zero each other out. A zero-count option is disabled.
//
// Context length is a single upper-bound filter: 200K means documented context
// windows greater than 0 and up to 200K tokens.

export type DirectoryFilterKey =
  | "modalities"
  | "context"
  | "inputPrice"
  | "outputPrice"
  | "vendors"
  | "providers"
  | "series"
  | "categories"
  | "age"
  | "distillable";

export type DirectoryFilters = {
  modalities: Modality[];
  context: number[];
  inputPrice: PriceBandId[];
  outputPrice: PriceBandId[];
  /** Model authors — who built the model. */
  vendors: string[];
  /** Where the model is officially served (author API plus the clouds). */
  providers: string[];
  series: string[];
  categories: string[];
  age: AgeBand[];
  distillable: boolean[];
  q?: string;
  /**
   * Legacy single-vendor param. The sitemap and older inbound links still use
   * ?vendor=<name>, so it keeps narrowing results alongside the `vendors`
   * group rather than being folded into it.
   */
  vendor?: string;
};

export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = {
  modalities: [],
  context: [],
  inputPrice: [],
  outputPrice: [],
  vendors: [],
  providers: [],
  series: [],
  categories: [],
  age: [],
  distillable: [],
};

export const DIRECTORY_FILTER_KEYS: DirectoryFilterKey[] = [
  "modalities",
  "context",
  "inputPrice",
  "outputPrice",
  "vendors",
  "providers",
  "series",
  "categories",
  "age",
  "distillable",
];

/**
 * Everything one row needs for filtering and sorting, resolved once per model
 * so a facet sweep across eight groups does not redo the derivations.
 */
export type DirectoryRow = {
  name: string;
  vendor: string;
  searchText: string;
  series?: string;
  /** Author from the metadata table; falls back to the payload's vendor. */
  author: string;
  providers: string[];
  modalities: Modality[];
  contextTokens: number | null;
  categories: string[];
  distillable?: boolean;
  age?: AgeBand;
  inputBand?: PriceBandId;
  outputBand?: PriceBandId;
  rank: number;
  top10?: number;
  releasedAt?: string | null;
  /**
   * Saving against the official rate, 0–1. Undefined when there is nothing to
   * compare against, which sorts last rather than reading as "no discount".
   */
  saving?: number;
};

export type DirectoryRowInput = {
  name: string;
  vendor: string;
  inputUsd?: number | null;
  outputUsd?: number | null;
  /** Official (pre-discount) input rate, for the discount sort. */
  officialUsd?: number;
  endpointTypes?: string[];
};

export function buildDirectoryRow(input: DirectoryRowInput, now: Date = new Date()): DirectoryRow {
  const meta = getModelMeta(input.name);
  const series = meta?.series ?? inferSeries(input.name);
  return {
    name: input.name,
    vendor: input.vendor,
    searchText: [input.name, input.vendor, meta?.vendor ?? "", series ?? "", ...(meta?.categories ?? []), ...(input.endpointTypes ?? [])]
      .join(" ")
      .toLowerCase(),
    series,
    author: meta?.vendor ?? input.vendor,
    providers: meta?.providers ?? [],
    modalities: meta?.modalities ?? [],
    contextTokens: meta?.contextTokens ?? null,
    categories: meta?.categories ?? [],
    distillable: meta?.distillable,
    age: ageBandFor(meta?.releasedAt, now),
    inputBand: priceBandFor(input.inputUsd ?? undefined),
    outputBand: priceBandFor(input.outputUsd ?? undefined),
    rank: meta?.rank ?? Number.MAX_SAFE_INTEGER,
    top10: meta?.top10,
    releasedAt: meta?.releasedAt,
    saving: savingRatio(input.officialUsd, input.inputUsd ?? undefined),
  };
}

/**
 * Fraction saved against the official rate. Computed from live prices, so a
 * repriced model re-sorts itself. Returns undefined when either side is
 * missing or the "discount" is not a real saving.
 */
export function savingRatio(officialUsd: number | undefined, ourUsd: number | undefined): number | undefined {
  if (officialUsd == null || ourUsd == null) return undefined;
  if (!Number.isFinite(officialUsd) || !Number.isFinite(ourUsd)) return undefined;
  if (officialUsd <= 0 || ourUsd < 0) return undefined;
  const saving = 1 - ourUsd / officialUsd;
  return saving >= 0 ? saving : undefined;
}

function matchesGroup(row: DirectoryRow, key: DirectoryFilterKey, filters: DirectoryFilters): boolean {
  switch (key) {
    case "modalities": {
      const selected = filters.modalities;
      return selected.length === 0 || selected.some((value) => row.modalities.includes(value));
    }
    case "context": {
      const selected = filters.context;
      if (selected.length === 0) return true;
      const upperBound = selected[0];
      return (
        Number.isFinite(upperBound) &&
        upperBound > 0 &&
        row.contextTokens != null &&
        Number.isFinite(row.contextTokens) &&
        row.contextTokens > 0 &&
        row.contextTokens <= upperBound
      );
    }
    case "inputPrice": {
      const selected = filters.inputPrice;
      return selected.length === 0 || (row.inputBand != null && selected.includes(row.inputBand));
    }
    case "outputPrice": {
      const selected = filters.outputPrice;
      return selected.length === 0 || (row.outputBand != null && selected.includes(row.outputBand));
    }
    case "vendors": {
      const selected = filters.vendors;
      return selected.length === 0 || selected.includes(row.author);
    }
    case "providers": {
      const selected = filters.providers;
      return selected.length === 0 || selected.some((value) => row.providers.includes(value));
    }
    case "series": {
      const selected = filters.series;
      return selected.length === 0 || (row.series != null && selected.includes(row.series));
    }
    case "categories": {
      const selected = filters.categories;
      return selected.length === 0 || selected.some((value) => row.categories.includes(value));
    }
    case "age": {
      const selected = filters.age;
      return selected.length === 0 || (row.age != null && selected.includes(row.age));
    }
    case "distillable": {
      const selected = filters.distillable;
      return selected.length === 0 || (row.distillable != null && selected.includes(row.distillable));
    }
  }
}

function matchesSearch(row: DirectoryRow, query: string | undefined): boolean {
  const trimmed = query?.trim().toLowerCase();
  if (!trimmed) return true;
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => row.searchText.includes(term));
}

function matchesVendor(row: DirectoryRow, vendor: string | undefined): boolean {
  if (!vendor || vendor === "all") return true;
  return row.vendor === vendor;
}

/**
 * @param exceptKey group to ignore — used when computing that group's own facet
 *   counts, so its options never suppress one another.
 */
export function filterDirectoryRows(
  rows: DirectoryRow[],
  filters: DirectoryFilters,
  exceptKey: DirectoryFilterKey | null = null
): DirectoryRow[] {
  return rows.filter(
    (row) =>
      matchesSearch(row, filters.q) &&
      matchesVendor(row, filters.vendor) &&
      DIRECTORY_FILTER_KEYS.every((key) => key === exceptKey || matchesGroup(row, key, filters))
  );
}

/** How many rows would remain if `value` were ticked in `key`. */
export function facetCount(
  rows: DirectoryRow[],
  filters: DirectoryFilters,
  key: DirectoryFilterKey,
  value: Modality | number | PriceBandId | string | boolean
): number {
  const base = filterDirectoryRows(rows, filters, key);
  const probe: DirectoryFilters = { ...filters, [key]: [value] } as DirectoryFilters;
  return base.filter((row) => matchesGroup(row, key, probe)).length;
}

export function hasActiveFilters(filters: DirectoryFilters): boolean {
  if (filters.q?.trim()) return true;
  if (filters.vendor && filters.vendor !== "all") return true;
  return DIRECTORY_FILTER_KEYS.some((key) => (filters[key] as unknown[]).length > 0);
}

export type DirectorySort = "rank" | "newest" | "discount" | "ctxDesc" | "name";

export const DIRECTORY_SORTS: DirectorySort[] = ["rank", "newest", "discount", "ctxDesc", "name"];

const AGE_ORDER: AgeBand[] = ["new", "1-3m", "3-6m", "6-12m", "12m+"];

// "Most Popular" leads with the popularity board in its exact order — the model
// badged TOP 1 sits first — then falls back to the overall ranking.
const byPopularity = (a: DirectoryRow, b: DirectoryRow) =>
  (a.top10 ?? Number.MAX_SAFE_INTEGER) - (b.top10 ?? Number.MAX_SAFE_INTEGER) || a.rank - b.rank;

// Newest sorts by release band, then by prominence inside the band. An unknown
// age sorts last rather than first, and the tiebreak leads with the popularity
// board because `rank` is the source listing order and would otherwise push
// anything appended later to the back regardless of how new it is.
const ageIndex = (age: AgeBand | undefined) => {
  const index = age ? AGE_ORDER.indexOf(age) : -1;
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

export function sortDirectoryRows(rows: DirectoryRow[], sort: DirectorySort): DirectoryRow[] {
  const sorted = [...rows];
  switch (sort) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "ctxDesc":
      return sorted.sort((a, b) => (b.contextTokens ?? 0) - (a.contextTokens ?? 0) || byPopularity(a, b));
    case "newest":
      return sorted.sort((a, b) => ageIndex(a.age) - ageIndex(b.age) || byPopularity(a, b));
    // Biggest saving first. A row with no comparable price sorts last rather
    // than mixing in with genuine 0% discounts.
    case "discount":
      return sorted.sort((a, b) => (b.saving ?? -1) - (a.saving ?? -1) || byPopularity(a, b));
    case "rank":
    default:
      return sorted.sort(byPopularity);
  }
}
