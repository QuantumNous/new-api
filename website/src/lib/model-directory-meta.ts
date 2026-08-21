import { MODEL_DIRECTORY_META } from "./model-directory-meta-data";

// Directory metadata that the pricing API does not carry: input modalities,
// context window, use-case categories, release date and distillability. The
// table itself is generated data (model-directory-meta-data.ts); this module
// owns the types and every derivation the UI needs on top of it.
//
// Everything price-related is deliberately absent. Prices, latency and health
// come from the live payload, so the price bands below are computed from the
// live number at render time rather than stored — a repriced model re-buckets
// itself instead of drifting out of its filter.

export type Modality = "text" | "image" | "file" | "audio" | "video";

export type ModelDirectoryMeta = {
  series: string;
  /**
   * Who built the model. Sourced here rather than from the pricing payload so
   * the label is stable — the payload leaves vendor_id empty for some models
   * (Macaron, Veo, Gemma), which would otherwise fall back to a placeholder.
   */
  vendor: string;
  /**
   * Where the model is officially served (author API plus the clouds it ships
   * to). Empty for models whose availability is not documented.
   */
  providers: string[];
  modalities: Modality[];
  /** null for image / video / TTS / music models with no token context window. */
  contextTokens: number | null;
  categories: string[];
  distillable: boolean;
  /** ISO date (YYYY-MM-DD); null when the release date is unknown. */
  releasedAt: string | null;
  rank: number;
  /** Position on the popularity board, when the model is on it. */
  top10?: number;
};

export type AgeBand = "new" | "1-3m" | "3-6m" | "6-12m" | "12m+";

export const MODALITIES: Modality[] = ["text", "image", "file", "audio", "video"];

export const CONTEXT_BUCKETS = [8192, 128000, 200000, 400000, 1048576] as const;

export const AGE_BANDS: AgeBand[] = ["new", "1-3m", "3-6m", "6-12m", "12m+"];

// Upper bound in days for each band; the last band is open-ended.
const AGE_BAND_MAX_DAYS: Record<Exclude<AgeBand, "12m+">, number> = {
  new: 30,
  "1-3m": 90,
  "3-6m": 180,
  "6-12m": 365,
};

export const PRICE_BANDS = [
  { id: "lt-0.5", max: 0.5 },
  { id: "0.5-1", min: 0.5, max: 1 },
  { id: "1-2", min: 1, max: 2 },
  { id: "2-5", min: 2, max: 5 },
  { id: "5-10", min: 5, max: 10 },
  { id: "10+", min: 10 },
] as const;

export type PriceBandId = (typeof PRICE_BANDS)[number]["id"];

export function getModelMeta(modelName: string): ModelDirectoryMeta | undefined {
  return MODEL_DIRECTORY_META[modelName];
}

/**
 * Price band for a live USD-per-unit figure. Bands are half-open [min, max) so
 * a boundary price lands in exactly one bucket. Returns undefined for
 * non-positive input, which reads as "unpriced" rather than "cheapest".
 */
export function priceBandFor(usd: number | undefined): PriceBandId | undefined {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return undefined;
  for (const band of PRICE_BANDS) {
    const aboveMin = !("min" in band) || usd >= band.min;
    const belowMax = !("max" in band) || usd < band.max;
    if (aboveMin && belowMax) return band.id;
  }
  return undefined;
}

/**
 * Age band relative to `now`, so the band is always current instead of a stored
 * label that decays. Unknown release dates return undefined and are excluded
 * from the age filter rather than defaulting into a band.
 */
export function ageBandFor(releasedAt: string | null | undefined, now: Date = new Date()): AgeBand | undefined {
  if (!releasedAt) return undefined;
  const released = Date.parse(`${releasedAt}T00:00:00Z`);
  if (Number.isNaN(released)) return undefined;
  const days = (now.getTime() - released) / 86_400_000;
  if (days < 0) return "new";
  for (const band of ["new", "1-3m", "3-6m", "6-12m"] as const) {
    if (days < AGE_BAND_MAX_DAYS[band]) return band;
  }
  return "12m+";
}

/** "1M" / "262K" / "8K" — compact context label for the table. */
export function formatContextTokens(tokens: number | null | undefined): string | undefined {
  if (tokens == null || !Number.isFinite(tokens) || tokens <= 0) return undefined;
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_048_576;
    const rounded = Math.round(millions * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}M`;
  }
  return `${Math.round(tokens / 1000)}K`;
}

/**
 * Series inferred from the model name, for models missing from the table.
 *
 * Some catalogue entries are namespaced as `vendor/model`
 * (e.g. `bytedance/seedance-2.0-fast`). The patterns below anchor at the start
 * of the name, so the namespace is stripped first — otherwise those rows infer
 * no series at all and lose their sub-label.
 */
export function inferSeries(modelName: string): string | undefined {
  const name = modelName.toLowerCase();
  const bare = name.includes("/") ? name.slice(name.lastIndexOf("/") + 1) : name;
  for (const [pattern, series] of SERIES_PATTERNS) {
    if (pattern.test(bare)) return series;
  }
  return undefined;
}

const SERIES_PATTERNS: Array<[RegExp, string]> = [
  [/^claude/, "Claude"],
  [/^(gpt|o\d|chatgpt|codex)/, "GPT"],
  [/^gemini/, "Gemini"],
  [/^gemma/, "Gemma"],
  [/^qwen/, "Qwen"],
  [/^deepseek/, "DeepSeek"],
  [/^(glm|chatglm)/, "GLM"],
  [/^minimax/, "MiniMax"],
  [/^(kimi|moonshot)/, "Kimi"],
  [/^grok/, "Grok"],
  [/^veo/, "Veo"],
  [/^nano-banana/, "Nano Banana"],
  [/^seedance/, "Seedance"],
  [/^macaron/, "Macaron"],
  [/^sonilo/, "Sonilo"],
];

/** Series present in the live catalogue, ordered by the table's own ranking. */
export function seriesForModels(modelNames: string[]): string[] {
  const bestRank = new Map<string, number>();
  for (const name of modelNames) {
    const meta = getModelMeta(name);
    const series = meta?.series ?? inferSeries(name);
    if (!series) continue;
    const rank = meta?.rank ?? Number.MAX_SAFE_INTEGER;
    const current = bestRank.get(series);
    if (current == null || rank < current) bestRank.set(series, rank);
  }
  return [...bestRank.entries()].sort(([, a], [, b]) => a - b).map(([series]) => series);
}

/** Model authors present in the live catalogue, most models first. */
export function vendorsForModels(modelNames: string[]): string[] {
  return countedValues(modelNames, (meta) => (meta.vendor ? [meta.vendor] : []));
}

/** Serving providers present in the live catalogue, most models first. */
export function providersForModels(modelNames: string[]): string[] {
  return countedValues(modelNames, (meta) => meta.providers ?? []);
}

function countedValues(modelNames: string[], pick: (meta: ModelDirectoryMeta) => string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of modelNames) {
    const meta = getModelMeta(name);
    if (!meta) continue;
    for (const value of pick(meta)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b)).map(([value]) => value);
}

/** Categories present in the live catalogue, most common first. */
export function categoriesForModels(modelNames: string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of modelNames) {
    for (const category of getModelMeta(name)?.categories ?? []) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b)).map(([category]) => category);
}
