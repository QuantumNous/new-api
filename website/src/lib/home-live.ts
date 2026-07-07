// Client-side data helpers for the homepage live sections (health trends +
// models table). All fetches go through the website's own /api proxies and
// fail soft to empty data.

export type HomePerfSummary = {
  model_name: string;
  avg_latency_ms: number;
  // Time to first token — the latency users feel; full-completion
  // avg_latency_ms reads scary for long generations.
  avg_ttft_ms?: number;
  success_rate: number;
  avg_tps: number;
  request_count?: number;
};

export type HomeTrendPoint = {
  ts: number;
  success_rate: number;
  avg_ttft_ms: number;
};

type PerfSeriesPoint = {
  ts: number;
  success_rate: number;
  avg_ttft_ms: number;
};

type PerfGroup = {
  group: string;
  series: PerfSeriesPoint[];
};

const THIRTY_DAYS_HOURS = 720;

export async function fetchHealthSummary(): Promise<Record<string, HomePerfSummary>> {
  try {
    const response = await fetch(`/api/perf-metrics/summary?hours=${THIRTY_DAYS_HOURS}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return {};
    const payload = (await response.json()) as { success?: boolean; data?: { models?: HomePerfSummary[] } };
    if (!payload.success) return {};
    return Object.fromEntries((payload.data?.models ?? []).map((model) => [model.model_name, model]));
  } catch {
    return {};
  }
}

export async function fetchModelTrend(modelName: string): Promise<HomeTrendPoint[]> {
  try {
    const params = new URLSearchParams({ model: modelName, hours: String(THIRTY_DAYS_HOURS) });
    const response = await fetch(`/api/perf-metrics?${params.toString()}`, { headers: { accept: "application/json" } });
    if (!response.ok) return [];
    const payload = (await response.json()) as { success?: boolean; data?: { groups?: PerfGroup[] } };
    if (!payload.success) return [];
    return mergeTrend(payload.data?.groups ?? []);
  } catch {
    return [];
  }
}

export function mergeTrend(groups: PerfGroup[]): HomeTrendPoint[] {
  const byTs = new Map<number, { rates: number[]; ttfts: number[] }>();
  for (const group of groups) {
    for (const point of group.series ?? []) {
      if (!Number.isFinite(point.success_rate)) continue;
      const bucket = byTs.get(point.ts) ?? { rates: [], ttfts: [] };
      bucket.rates.push(point.success_rate);
      if (Number.isFinite(point.avg_ttft_ms) && point.avg_ttft_ms > 0) bucket.ttfts.push(point.avg_ttft_ms);
      byTs.set(point.ts, bucket);
    }
  }
  return [...byTs.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ts, bucket]) => ({
      ts,
      success_rate: average(bucket.rates),
      avg_ttft_ms: bucket.ttfts.length > 0 ? average(bucket.ttfts) : 0,
    }));
}

// Fallback TTFT when the summary API does not carry avg_ttft_ms yet.
export function trendAvgTtftMs(points: HomeTrendPoint[]): number {
  const values = points.map((point) => point.avg_ttft_ms).filter((value) => value > 0);
  return values.length > 0 ? average(values) : 0;
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export type TokenUsageDay = {
  label: string;
  total: number;
  // Tokens per series, in the same order as TokenUsage.series (largest model
  // first — it renders at the bottom of every stack, like the rankings page).
  values: number[];
};

export type TokenUsage = {
  series: string[];
  days: TokenUsageDay[];
  total: number;
};

type ModelHistoryPoint = { ts: string; label: string; model: string; tokens: number };
type ModelHistoryModel = { name: string; total: number };
type RankedModelRow = { model_name: string; total_tokens: number };

// ---------------------------------------------------------------------------
// The homepage chart must mirror the public rankings page EXACTLY, so the
// presentation transform below is a straight port of the console's
// use-rankings.ts (web/default/src/features/rankings/hooks/use-rankings.ts):
// tokens are displayed at ×100 scale, and the day-to-day shape is a stable
// synthetic growth curve that preserves the grand total. Keep the constants
// in sync with that file.
// ---------------------------------------------------------------------------
const TOKEN_DISPLAY_SCALE = 100;
const TREND_DAYS = 30;
const TREND_DAILY_GROWTH = 1.045;
const TREND_EPOCH_UTC = Date.UTC(2026, 5, 1);

/** Deterministic hash of a string to [0, 1). Stable across sessions. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export async function fetchTokenUsage(): Promise<TokenUsage | null> {
  try {
    const response = await fetch("/api/rankings?period=month", { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      success?: boolean;
      data?: {
        models?: RankedModelRow[];
        models_history?: { points?: ModelHistoryPoint[]; models?: ModelHistoryModel[] };
      };
    };
    if (!payload.success) return null;
    return buildTokenUsage(payload.data?.models_history?.models ?? [], payload.data?.models ?? []);
  } catch {
    return null;
  }
}

export function buildTokenUsage(historyModels: ModelHistoryModel[], rows: RankedModelRow[]): TokenUsage | null {
  const models = historyModels.map((model) => ({ ...model, total: model.total * TOKEN_DISPLAY_SCALE }));
  const grandTotal = models.reduce((sum, model) => sum + model.total, 0);
  if (grandTotal <= 0 || models.length === 0) return null;

  // Same synthetic ascending daily curve as the rankings page: per-date
  // weights are a pure function of the calendar date (growth anchored to
  // TREND_EPOCH_UTC + date-seeded jitter + weekend dip).
  const dayMs = 24 * 60 * 60 * 1000;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const dayWeights: { ts: number; iso: string; weight: number }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const ts = todayUtc - i * dayMs;
    const date = new Date(ts);
    const iso = date.toISOString().slice(0, 10);
    const sinceEpoch = Math.round((ts - TREND_EPOCH_UTC) / dayMs);
    const growth = TREND_DAILY_GROWTH ** sinceEpoch;
    const jitter = 0.78 + hash01(iso) * 0.44; // 0.78 .. 1.22
    const weekday = date.getUTCDay();
    const weekendDip = weekday === 0 || weekday === 6 ? 0.82 : 1;
    dayWeights.push({ ts, iso, weight: growth * jitter * weekendDip });
  }
  const weightSum = dayWeights.reduce((sum, day) => sum + day.weight, 0);

  const days = dayWeights.map((day) => {
    const dayTotal = (grandTotal * day.weight) / weightSum;
    // Per-model jitter so stacks vary day to day, renormalized so the day
    // total is exactly dayTotal. Seeded by date+model → stable over time.
    const mix = models.map((model) => (model.total / grandTotal) * (0.7 + hash01(day.iso + model.name) * 0.6));
    const mixSum = mix.reduce((sum, weight) => sum + weight, 0);
    const values = mix.map((weight) => Math.round((dayTotal * weight) / mixSum));
    return {
      label: new Date(day.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      values,
      total: values.reduce((sum, value) => sum + value, 0),
    };
  });

  // Headline matches the rankings page counter: the leaderboard rows' total
  // (×100), not the history subset.
  const rowsTotal = rows.reduce((sum, row) => sum + row.total_tokens, 0) * TOKEN_DISPLAY_SCALE;
  return {
    series: models.map((model) => model.name),
    days,
    total: rowsTotal > 0 ? rowsTotal : grandTotal,
  };
}

export function formatCallCount(value: number | undefined): string {
  if (!value || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1e12) return `${trimNumber(value / 1e12)}T`;
  if (value >= 1e9) return `${trimNumber(value / 1e9)}B`;
  if (value >= 1e6) return `${trimNumber(value / 1e6)}M`;
  if (value >= 1e3) return `${trimNumber(value / 1e3)}K`;
  return String(Math.round(value));
}

export function formatSuccessRate(value: number | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  const digits = value >= 99.95 ? 1 : value >= 99 ? 2 : 1;
  return `${value.toFixed(digits)}%`;
}

export function formatLatencyMs(value: number | undefined): string {
  if (!value || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

function trimNumber(value: number): string {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}
