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
  // Tokens per series, in the same order as TokenUsage.series ("Other" last).
  values: number[];
};

export type TokenUsage = {
  series: string[];
  days: TokenUsageDay[];
  total: number;
};

type ModelHistoryPoint = { ts: string; label: string; model: string; tokens: number };
type ModelHistoryModel = { name: string; total: number };

export const TOKEN_USAGE_TOP_SERIES = 6;
export const TOKEN_USAGE_OTHER = "Other";

export async function fetchTokenUsage(): Promise<TokenUsage | null> {
  try {
    const response = await fetch("/api/rankings?period=month", { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      success?: boolean;
      data?: { models_history?: { points?: ModelHistoryPoint[]; models?: ModelHistoryModel[] } };
    };
    if (!payload.success) return null;
    const history = payload.data?.models_history;
    return buildTokenUsage(history?.points ?? [], history?.models ?? []);
  } catch {
    return null;
  }
}

export function buildTokenUsage(points: ModelHistoryPoint[], models: ModelHistoryModel[]): TokenUsage | null {
  if (points.length === 0) return null;
  // The rankings API ships its own "Others" aggregate — fold it into our
  // Other bucket instead of letting it compete for a named series slot.
  const isAggregate = (name: string) => /^others?$/i.test(name);
  const named = models.filter((model) => !isAggregate(model.name));
  const top = [...named].sort((a, b) => b.total - a.total).slice(0, TOKEN_USAGE_TOP_SERIES).map((model) => model.name);
  const hasOther = models.length > top.length;
  const series = hasOther ? [...top, TOKEN_USAGE_OTHER] : top;
  const seriesIndex = new Map(series.map((name, index) => [name, index]));

  const byDay = new Map<string, { label: string; values: number[] }>();
  for (const point of points) {
    const day = byDay.get(point.ts) ?? { label: point.label, values: series.map(() => 0) };
    const index = seriesIndex.get(point.model) ?? (hasOther ? series.length - 1 : -1);
    if (index >= 0) day.values[index] += point.tokens;
    byDay.set(point.ts, day);
  }

  const days = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, day]) => ({ label: day.label, values: day.values, total: day.values.reduce((sum, value) => sum + value, 0) }));
  const total = days.reduce((sum, day) => sum + day.total, 0);
  if (total <= 0) return null;
  return { series, days, total };
}

export function formatCallCount(value: number | undefined): string {
  if (!value || !Number.isFinite(value) || value <= 0) return "—";
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
