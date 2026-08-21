import { describe, expect, test } from "bun:test";
import {
  buildDirectoryRow,
  facetCount,
  filterDirectoryRows,
  hasActiveFilters,
  sortDirectoryRows,
  EMPTY_DIRECTORY_FILTERS,
  type DirectoryRow,
  type DirectoryFilters,
} from "./model-directory-filters";
import { ageBandFor, formatContextTokens, priceBandFor, seriesForModels } from "./model-directory-meta";
import type { ModelDirectoryMetadata } from "./pricing";
import { directoryHref, directorySearchQuery, parseDirectorySearch, toggleDirectoryFilter } from "./model-directory-url";

const NOW = new Date("2026-08-19T00:00:00Z");

function metadata(
  author: string,
  series: string,
  popularityRank: number,
  overrides: Partial<ModelDirectoryMetadata> = {}
): ModelDirectoryMetadata {
  return {
    author,
    providers: [author],
    modalities: ["text", "image"],
    context_tokens: 128000,
    series,
    categories: ["Programming"],
    released_at: "2026-04-06",
    distillable: false,
    popularity_rank: popularityRank,
    ...overrides,
  };
}

const TEST_METADATA: Record<string, ModelDirectoryMetadata> = {
  "claude-opus-5": metadata("Anthropic", "Claude", 14, {
    providers: ["Anthropic", "Claude Platform on AWS"],
    context_tokens: 1048576,
    top_ten_rank: 9,
    released_at: "2026-08-04",
  }),
  "gpt-5.6-sol": metadata("OpenAI", "GPT", 23, {
    providers: ["OpenAI", "Azure"], context_tokens: 1048576, top_ten_rank: 2, released_at: "2026-06-20",
  }),
  "gpt-4o-mini": metadata("OpenAI", "GPT", 24, { providers: ["OpenAI", "Azure"] }),
  "deepseek-v4-pro": metadata("DeepSeek", "DeepSeek", 10, { top_ten_rank: 4, context_tokens: 1048576 }),
  "seedance-2.5": metadata("ByteDance", "Seedance", 94, {
    providers: ["ByteDance"], modalities: ["text", "image", "video"], context_tokens: null,
    categories: ["Marketing"], top_ten_rank: 8, released_at: "2026-08-04",
  }),
  "gemini-2.5-flash": metadata("Google", "Gemini", 62, {
    providers: ["Google"], modalities: ["text", "image", "file", "audio", "video"], context_tokens: 1048576,
    released_at: "2025-05-26",
  }),
  "macaron-v1-venti": metadata("Macaron", "Macaron", 85, { providers: ["Macaron"], context_tokens: 1048576 }),
};

function rows(
  names: Array<{ name: string; vendor: string; inputUsd?: number; outputUsd?: number; officialUsd?: number }>
) {
  return names.map((input) => buildDirectoryRow({ ...input, metadata: TEST_METADATA[input.name] }, NOW));
}

const SAMPLE = rows([
  { name: "claude-opus-5", vendor: "Anthropic", inputUsd: 5, outputUsd: 25 },
  { name: "gpt-5.6-sol", vendor: "OpenAI", inputUsd: 5, outputUsd: 7 },
  { name: "gpt-4o-mini", vendor: "OpenAI", inputUsd: 0.15, outputUsd: 0.6 },
  { name: "deepseek-v4-pro", vendor: "DeepSeek", inputUsd: 1.32, outputUsd: 2 },
  { name: "seedance-2.5", vendor: "ByteDance", inputUsd: 0.14 },
  { name: "gemini-2.5-flash", vendor: "Google", inputUsd: 0.3, outputUsd: 2.5 },
]);

function withFilters(overrides: Partial<DirectoryFilters>): DirectoryFilters {
  return { ...EMPTY_DIRECTORY_FILTERS, ...overrides };
}

function contextRow(name: string, contextTokens: number | null): DirectoryRow {
  return {
    name,
    vendor: "Test",
    searchText: name,
    author: "Test",
    providers: [],
    modalities: [],
    contextTokens,
    categories: [],
    rank: 1,
  };
}

describe("price banding", () => {
  test("buckets on half-open ranges so boundaries land in exactly one band", () => {
    expect(priceBandFor(0.49)).toBe("lt-0.5");
    expect(priceBandFor(0.5)).toBe("0.5-1");
    expect(priceBandFor(1)).toBe("1-2");
    expect(priceBandFor(5)).toBe("5-10");
    expect(priceBandFor(25)).toBe("10+");
  });

  test("positive band boundaries are strict and non-overlapping", () => {
    expect(priceBandFor(0.499999)).toBe("lt-0.5");
    expect(priceBandFor(0.5)).toBe("0.5-1");
    expect(priceBandFor(0.999999)).toBe("0.5-1");
    expect(priceBandFor(1)).toBe("1-2");
    expect(priceBandFor(1.999999)).toBe("1-2");
    expect(priceBandFor(2)).toBe("2-5");
    expect(priceBandFor(4.999999)).toBe("2-5");
    expect(priceBandFor(5)).toBe("5-10");
    expect(priceBandFor(9.999999)).toBe("5-10");
    expect(priceBandFor(10)).toBe("10+");
  });

  test("treats missing, non-positive and non-finite prices as unpriced, not cheapest", () => {
    expect(priceBandFor(undefined)).toBeUndefined();
    expect(priceBandFor(null as unknown as number | undefined)).toBeUndefined();
    expect(priceBandFor(0)).toBeUndefined();
    expect(priceBandFor(-1)).toBeUndefined();
    expect(priceBandFor(Number.NaN)).toBeUndefined();
    expect(priceBandFor(Infinity)).toBeUndefined();
  });
});

describe("age banding", () => {
  test("recomputes the band against the current date", () => {
    expect(ageBandFor("2026-08-04", NOW)).toBe("new");
    expect(ageBandFor("2026-06-20", NOW)).toBe("1-3m");
    expect(ageBandFor("2026-04-06", NOW)).toBe("3-6m");
    expect(ageBandFor("2025-11-22", NOW)).toBe("6-12m");
    expect(ageBandFor("2025-05-26", NOW)).toBe("12m+");
  });

  test("a date that was New last year reads as older today", () => {
    expect(ageBandFor("2026-08-04", new Date("2027-08-19T00:00:00Z"))).toBe("12m+");
  });

  test("returns undefined for unknown dates rather than defaulting into a band", () => {
    expect(ageBandFor(null, NOW)).toBeUndefined();
    expect(ageBandFor("not-a-date", NOW)).toBeUndefined();
  });
});

describe("filter semantics", () => {
  test("within a group is OR", () => {
    const result = filterDirectoryRows(SAMPLE, withFilters({ series: ["GPT", "Claude"] }));
    expect(result.map((row) => row.name).sort()).toEqual(["claude-opus-5", "gpt-4o-mini", "gpt-5.6-sol"]);
  });

  test("across groups is AND", () => {
    const result = filterDirectoryRows(SAMPLE, withFilters({ series: ["GPT"], modalities: ["image"] }));
    expect(result.map((row) => row.name).sort()).toEqual(["gpt-4o-mini", "gpt-5.6-sol"]);

    const narrowed = filterDirectoryRows(SAMPLE, withFilters({ series: ["GPT"], modalities: ["video"] }));
    expect(narrowed).toHaveLength(0);
  });

  test("context length is a single upper-bound filter", () => {
    const contextRows = [
      contextRow("ctx-128000", 128000),
      contextRow("ctx-200000", 200000),
      contextRow("ctx-400000", 400000),
      contextRow("ctx-zero", 0),
      contextRow("ctx-null", null),
      contextRow("ctx-nan", Number.NaN),
      contextRow("ctx-infinity", Infinity),
    ];

    const result = filterDirectoryRows(contextRows, withFilters({ context: [200000] }));

    expect(result.map((row) => row.name)).toEqual(["ctx-128000", "ctx-200000"]);
  });

  test("models with no context window are excluded from context filters", () => {
    const result = filterDirectoryRows(SAMPLE, withFilters({ context: [8192] }));
    expect(result.map((row) => row.name)).not.toContain("seedance-2.5");
  });

  test("price bands filter on the live figure, not stored metadata", () => {
    const cheap = filterDirectoryRows(SAMPLE, withFilters({ inputPrice: ["lt-0.5"] }));
    expect(cheap.map((row) => row.name).sort()).toEqual(["gemini-2.5-flash", "gpt-4o-mini", "seedance-2.5"]);

    const repriced = rows([{ name: "gpt-4o-mini", vendor: "OpenAI", inputUsd: 6 }]);
    expect(filterDirectoryRows(repriced, withFilters({ inputPrice: ["lt-0.5"] }))).toHaveLength(0);
    expect(filterDirectoryRows(repriced, withFilters({ inputPrice: ["5-10"] }))).toHaveLength(1);
  });

  test("token rows filter input and output prices independently", () => {
    const token = rows([{ name: "gpt-4o-mini", vendor: "OpenAI", inputUsd: 0.36, outputUsd: 1.44 }]);

    expect(filterDirectoryRows(token, withFilters({ inputPrice: ["lt-0.5"] }))).toHaveLength(1);
    expect(filterDirectoryRows(token, withFilters({ outputPrice: ["lt-0.5"] }))).toHaveLength(0);
    expect(filterDirectoryRows(token, withFilters({ outputPrice: ["1-2"] }))).toHaveLength(1);
  });

  test("request and second rows filter the same final display price through both price groups", () => {
    const mixed = rows([
      { name: "request-priced-model", vendor: "VideoCo", inputUsd: 0.9, outputUsd: 0.9 },
      { name: "second-priced-model", vendor: "VideoCo", inputUsd: 0.072, outputUsd: 0.072 },
    ]);

    expect(filterDirectoryRows(mixed, withFilters({ inputPrice: ["0.5-1"] })).map((row) => row.name)).toEqual([
      "request-priced-model",
    ]);
    expect(filterDirectoryRows(mixed, withFilters({ outputPrice: ["0.5-1"] })).map((row) => row.name)).toEqual([
      "request-priced-model",
    ]);
    expect(filterDirectoryRows(mixed, withFilters({ inputPrice: ["lt-0.5"] })).map((row) => row.name)).toEqual([
      "second-priced-model",
    ]);
    expect(filterDirectoryRows(mixed, withFilters({ outputPrice: ["lt-0.5"] })).map((row) => row.name)).toEqual([
      "second-priced-model",
    ]);
  });

  test("unpriced rows remain without active price filters and drop only when a price filter is active", () => {
    const unpriced = rows([
      { name: "zero-price", vendor: "Test", inputUsd: 0, outputUsd: 0 },
      { name: "negative-price", vendor: "Test", inputUsd: -1, outputUsd: -1 },
      { name: "null-price", vendor: "Test", inputUsd: null, outputUsd: null },
      { name: "undefined-price", vendor: "Test" },
      { name: "nan-price", vendor: "Test", inputUsd: Number.NaN, outputUsd: Number.NaN },
      { name: "infinite-price", vendor: "Test", inputUsd: Infinity, outputUsd: Infinity },
    ]);

    expect(filterDirectoryRows(unpriced, EMPTY_DIRECTORY_FILTERS)).toHaveLength(unpriced.length);
    expect(filterDirectoryRows(unpriced, withFilters({ inputPrice: ["lt-0.5"] }))).toHaveLength(0);
    expect(filterDirectoryRows(unpriced, withFilters({ outputPrice: ["lt-0.5"] }))).toHaveLength(0);
  });

  test("search matches every term across name, vendor, series and categories", () => {
    expect(filterDirectoryRows(SAMPLE, withFilters({ q: "openai mini" })).map((row) => row.name)).toEqual(["gpt-4o-mini"]);
    expect(filterDirectoryRows(SAMPLE, withFilters({ q: "anthropic" })).map((row) => row.name)).toEqual(["claude-opus-5"]);
    expect(filterDirectoryRows(SAMPLE, withFilters({ q: "nonexistent" }))).toHaveLength(0);
  });

  test("vendor filter from existing sitemap links still applies", () => {
    expect(filterDirectoryRows(SAMPLE, withFilters({ vendor: "OpenAI" }))).toHaveLength(2);
    expect(filterDirectoryRows(SAMPLE, withFilters({ vendor: "all" }))).toHaveLength(SAMPLE.length);
  });

  test("the model-authors group is OR within itself", () => {
    const result = filterDirectoryRows(SAMPLE, withFilters({ vendors: ["OpenAI", "Anthropic"] }));
    expect(result.map((row) => row.name).sort()).toEqual(["claude-opus-5", "gpt-4o-mini", "gpt-5.6-sol"]);
  });

  test("the author comes from metadata, not the payload's placeholder vendor", () => {
    // The payload has no vendor for these, so getVendorName yields "AI".
    const row = buildDirectoryRow({ name: "macaron-v1-venti", vendor: "AI", metadata: TEST_METADATA["macaron-v1-venti"] }, NOW);
    expect(row.author).toBe("Macaron");
    expect(filterDirectoryRows([row], withFilters({ vendors: ["Macaron"] }))).toHaveLength(1);
    expect(filterDirectoryRows([row], withFilters({ vendors: ["AI"] }))).toHaveLength(0);
  });

  test("providers is OR within itself and AND across groups", () => {
    const rows = [
      buildDirectoryRow({ name: "claude-opus-5", vendor: "Anthropic", metadata: TEST_METADATA["claude-opus-5"] }, NOW),
      buildDirectoryRow({ name: "gpt-5.6-sol", vendor: "OpenAI", metadata: TEST_METADATA["gpt-5.6-sol"] }, NOW),
    ];
    // Claude Platform on AWS serves the Claude model but not the GPT one.
    const claudeOnly = filterDirectoryRows(rows, withFilters({ providers: ["Claude Platform on AWS"] }));
    expect(claudeOnly.map((row) => row.name)).toEqual(["claude-opus-5"]);

    // OR within the group: each option pulls in its own model.
    const either = filterDirectoryRows(rows, withFilters({ providers: ["Claude Platform on AWS", "OpenAI"] }));
    expect(either).toHaveLength(2);

    // AND across groups: an author that does not serve on that platform yields none.
    expect(
      filterDirectoryRows(rows, withFilters({ providers: ["Claude Platform on AWS"], vendors: ["OpenAI"] }))
    ).toHaveLength(0);
  });

  test("models with no documented providers drop out of that filter", () => {
    const row = buildDirectoryRow({ name: "unregistered-preview-model", vendor: "Unknown" }, NOW);
    expect(row.providers).toEqual([]);
    expect(filterDirectoryRows([row], withFilters({ providers: ["Minimax"] }))).toHaveLength(0);
    expect(filterDirectoryRows([row], EMPTY_DIRECTORY_FILTERS)).toHaveLength(1);
  });

  test("model authors AND across other groups", () => {
    const result = filterDirectoryRows(SAMPLE, withFilters({ vendors: ["OpenAI"], inputPrice: ["lt-0.5"] }));
    expect(result.map((row) => row.name)).toEqual(["gpt-4o-mini"]);
  });

  test("the legacy single-vendor param narrows alongside the group", () => {
    // ?vendor=Google plus a group selection that excludes Google yields nothing,
    // rather than one silently overriding the other.
    expect(filterDirectoryRows(SAMPLE, withFilters({ vendor: "Google", vendors: ["OpenAI"] }))).toHaveLength(0);
    expect(filterDirectoryRows(SAMPLE, withFilters({ vendor: "OpenAI", vendors: ["OpenAI"] }))).toHaveLength(2);
  });
});

describe("facet counts", () => {
  test("ignore other selections in the same group so siblings never zero out", () => {
    const filters = withFilters({ series: ["GPT"] });
    expect(facetCount(SAMPLE, filters, "series", "Claude")).toBe(1);
    expect(facetCount(SAMPLE, filters, "series", "DeepSeek")).toBe(1);
  });

  test("respect selections in other groups", () => {
    const filters = withFilters({ modalities: ["video"] });
    expect(facetCount(SAMPLE, filters, "series", "GPT")).toBe(0);
    expect(facetCount(SAMPLE, filters, "series", "Seedance")).toBe(1);
  });

  test("single-select context facet counts replace the active context value", () => {
    const contextRows = [
      contextRow("ctx-128000", 128000),
      contextRow("ctx-200000", 200000),
      contextRow("ctx-400000", 400000),
    ];
    const filters = withFilters({ context: [200000] });

    expect(facetCount(contextRows, filters, "context", 128000)).toBe(1);
    expect(facetCount(contextRows, filters, "context", 400000)).toBe(3);
  });
});

describe("sorting", () => {
  test("most popular leads with the board order, then overall rank", () => {
    const sorted = sortDirectoryRows(SAMPLE, "rank");
    expect(sorted[0].name).toBe("gpt-5.6-sol"); // TOP 2 — the lowest board position present
    expect(sorted.map((row) => row.name).slice(0, 3)).toEqual(["gpt-5.6-sol", "deepseek-v4-pro", "seedance-2.5"]);
  });

  test("longest context first, unknown context last", () => {
    const sorted = sortDirectoryRows(SAMPLE, "ctxDesc");
    expect(sorted[sorted.length - 1].name).toBe("seedance-2.5");
  });

  test("newest orders by band and leaves unknown ages last", () => {
    const withUnknown = [...SAMPLE, buildDirectoryRow({ name: "totally-unknown-model", vendor: "Nobody" }, NOW)];
    const sorted = sortDirectoryRows(withUnknown, "newest");
    expect(sorted[0].age).toBe("new");
    expect(sorted[sorted.length - 1].name).toBe("totally-unknown-model");
  });

  test("name sorts alphabetically", () => {
    expect(sortDirectoryRows(SAMPLE, "name")[0].name).toBe("claude-opus-5");
  });

  test("biggest discount first, computed from live prices", () => {
    const priced = rows([
      { name: "gpt-5.6-sol", vendor: "OpenAI", officialUsd: 5, inputUsd: 1.5 }, // 70%
      { name: "claude-opus-5", vendor: "Anthropic", officialUsd: 5, inputUsd: 4.5 }, // 10%
      { name: "deepseek-v4-pro", vendor: "DeepSeek", officialUsd: 1.32, inputUsd: 1.122 }, // 15%
    ]);
    expect(sortDirectoryRows(priced, "discount").map((row) => row.name)).toEqual([
      "gpt-5.6-sol",
      "deepseek-v4-pro",
      "claude-opus-5",
    ]);
  });

  test("rows with no comparable price sort last, not as a 0% discount", () => {
    const mixed = rows([
      { name: "claude-opus-5", vendor: "Anthropic", officialUsd: 5, inputUsd: 5 }, // real 0%
      { name: "seedance-2.5", vendor: "ByteDance", inputUsd: 0.14 }, // no official price
      { name: "gpt-5.6-sol", vendor: "OpenAI", officialUsd: 5, inputUsd: 4 }, // 20%
    ]);
    const sorted = sortDirectoryRows(mixed, "discount").map((row) => row.name);
    expect(sorted[0]).toBe("gpt-5.6-sol");
    expect(sorted[sorted.length - 1]).toBe("seedance-2.5");
  });

  test("a reprice changes the discount order without touching metadata", () => {
    const before = rows([
      { name: "gpt-4o-mini", vendor: "OpenAI", officialUsd: 1, inputUsd: 0.9 }, // 10%
      { name: "claude-opus-5", vendor: "Anthropic", officialUsd: 1, inputUsd: 0.5 }, // 50%
    ]);
    expect(sortDirectoryRows(before, "discount")[0].name).toBe("claude-opus-5");

    const after = rows([
      { name: "gpt-4o-mini", vendor: "OpenAI", officialUsd: 1, inputUsd: 0.1 }, // now 90%
      { name: "claude-opus-5", vendor: "Anthropic", officialUsd: 1, inputUsd: 0.5 },
    ]);
    expect(sortDirectoryRows(after, "discount")[0].name).toBe("gpt-4o-mini");
  });
});

describe("unknown models degrade gracefully", () => {
  const unknown = buildDirectoryRow({ name: "brand-new-model-2027", vendor: "NewCo", inputUsd: 2 }, NOW);

  test("still render and stay searchable", () => {
    expect(filterDirectoryRows([unknown], EMPTY_DIRECTORY_FILTERS)).toHaveLength(1);
    expect(filterDirectoryRows([unknown], withFilters({ q: "newco" }))).toHaveLength(1);
  });

  test("drop out of metadata-driven filters but keep live price filters", () => {
    expect(filterDirectoryRows([unknown], withFilters({ modalities: ["text"] }))).toHaveLength(0);
    expect(filterDirectoryRows([unknown], withFilters({ age: ["new"] }))).toHaveLength(0);
    expect(filterDirectoryRows([unknown], withFilters({ inputPrice: ["2-5"] }))).toHaveLength(1);
  });

  test("does not infer a series when database metadata is missing", () => {
    const inferred = buildDirectoryRow({ name: "claude-opus-9-future", vendor: "Anthropic" }, NOW);
    expect(inferred.series).toBeUndefined();
    expect(filterDirectoryRows([inferred], withFilters({ series: ["Claude"] }))).toHaveLength(0);
  });
});

describe("url round-trip", () => {
  test("serializes and re-parses every group", () => {
    const filters = withFilters({
      modalities: ["image", "video"],
      context: [1048576],
      inputPrice: ["lt-0.5"],
      outputPrice: ["10+"],
      vendors: ["OpenAI", "Anthropic"],
      providers: ["Azure"],
      series: ["GPT", "Claude"],
      categories: ["Programming"],
      age: ["new"],
      distillable: [true],
      q: "vision",
    });

    const parsed = parseDirectorySearch(Object.fromEntries(new URLSearchParams(directorySearchQuery(filters, "newest"))));
    expect(parsed.modalities).toEqual(["image", "video"]);
    expect(parsed.context).toEqual([1048576]);
    expect(parsed.inputPrice).toEqual(["lt-0.5"]);
    expect(parsed.outputPrice).toEqual(["10+"]);
    expect(parsed.vendors).toEqual(["OpenAI", "Anthropic"]);
    expect(parsed.providers).toEqual(["Azure"]);
    expect(parsed.series).toEqual(["GPT", "Claude"]);
    expect(parsed.age).toEqual(["new"]);
    expect(parsed.distillable).toEqual([true]);
    expect(parsed.q).toBe("vision");
    expect(parsed.sort).toBe("newest");
  });

  test("omits the default sort and empty groups", () => {
    expect(directorySearchQuery(EMPTY_DIRECTORY_FILTERS, "rank")).toBe("");
    expect(directoryHref("en", EMPTY_DIRECTORY_FILTERS)).toBe("/models");
    expect(directoryHref("zh", withFilters({ series: ["GPT"] }))).toBe("/zh/models?series=GPT");
  });

  test("drops malformed values instead of throwing", () => {
    const parsed = parseDirectorySearch({
      modalities: "image,telepathy",
      context: "1048576,abc",
      age: "new,ancient",
      distillable: "maybe",
      sort: "bogus",
    });
    expect(parsed.modalities).toEqual(["image"]);
    expect(parsed.context).toEqual([1048576]);
    expect(parsed.age).toEqual(["new"]);
    expect(parsed.distillable).toEqual([]);
    expect(parsed.sort).toBe("rank");
  });

  test("normalizes legacy multi-value single-select filters to the first valid value", () => {
    expect(parseDirectorySearch({ context: "8192,200000" }).context).toEqual([8192]);
    expect(parseDirectorySearch({ distillable: "false,true" }).distillable).toEqual([false]);
  });

  test("normalizes repeated-param single-select filters to the first valid value across entries", () => {
    expect(parseDirectorySearch({ context: ["abc", "200000,400000"] }).context).toEqual([200000]);
    expect(parseDirectorySearch({ distillable: ["maybe", "true,false"] }).distillable).toEqual([true]);
  });

  test("toggling adds then removes a value", () => {
    const once = toggleDirectoryFilter(EMPTY_DIRECTORY_FILTERS, "series", "GPT");
    expect(once.series).toEqual(["GPT"]);
    expect(toggleDirectoryFilter(once, "series", "GPT").series).toEqual([]);
  });

  test("toggling context replaces a different value and clears the same value", () => {
    const initial = withFilters({ context: [8192] });

    const replaced = toggleDirectoryFilter(initial, "context", 200000);
    expect(replaced.context).toEqual([200000]);
    expect(toggleDirectoryFilter(replaced, "context", 200000).context).toEqual([]);
  });

  test("toggling distillable replaces a different value and preserves other groups as multi-select", () => {
    const replaced = toggleDirectoryFilter(withFilters({ distillable: [false] }), "distillable", true);
    expect(replaced.distillable).toEqual([true]);

    const multi = toggleDirectoryFilter(withFilters({ series: ["GPT"] }), "series", "Claude");
    expect(multi.series).toEqual(["GPT", "Claude"]);
  });

  test("hasActiveFilters reflects search, vendor and groups", () => {
    expect(hasActiveFilters(EMPTY_DIRECTORY_FILTERS)).toBe(false);
    expect(hasActiveFilters(withFilters({ q: "gpt" }))).toBe(true);
    expect(hasActiveFilters(withFilters({ vendor: "OpenAI" }))).toBe(true);
    expect(hasActiveFilters(withFilters({ vendor: "all" }))).toBe(false);
    expect(hasActiveFilters(withFilters({ modalities: ["text"] }))).toBe(true);
  });
});

describe("metadata table", () => {
  test("context labels read compactly", () => {
    expect(formatContextTokens(1048576)).toBe("1M");
    expect(formatContextTokens(262144)).toBe("262K");
    expect(formatContextTokens(128000)).toBe("128K");
    expect(formatContextTokens(null)).toBeUndefined();
  });

  test("series listing is ordered by the best rank in each family", () => {
    const series = seriesForModels([
      metadata("OpenAI", "GPT", 24),
      metadata("DeepSeek", "DeepSeek", 9),
      metadata("Anthropic", "Claude", 14),
    ]);
    expect(series).toEqual(["DeepSeek", "Claude", "GPT"]);
  });
});
