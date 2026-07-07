// Client-side data helpers for the homepage live sections (health trends +
// models table). All fetches go through the website's own /api proxies and
// fail soft to empty data.

export type HomePerfSummary = {
  model_name: string;
  avg_latency_ms: number;
  success_rate: number;
  avg_tps: number;
  request_count?: number;
};

export type HomeTrendPoint = {
  ts: number;
  success_rate: number;
};

type PerfSeriesPoint = {
  ts: number;
  success_rate: number;
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
  const byTs = new Map<number, number[]>();
  for (const group of groups) {
    for (const point of group.series ?? []) {
      if (!Number.isFinite(point.success_rate)) continue;
      const values = byTs.get(point.ts) ?? [];
      values.push(point.success_rate);
      byTs.set(point.ts, values);
    }
  }
  return [...byTs.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ts, values]) => ({ ts, success_rate: values.reduce((sum, value) => sum + value, 0) / values.length }));
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
