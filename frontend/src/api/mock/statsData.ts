/**
 * Mock statistics data for the Stats dashboard tab.
 */
import { dashboardStats, flowSeries, modelShare, logs } from './data'
import type { FlowPoint } from '@/composables/useDashboard'
import type { StatsPeriod, HourlyPoint } from '@/composables/useDashboardStats'

/** Generate hourly distribution from the log data (requests per hour of day). */
function buildHourly(): HourlyPoint[] {
  // Seeded deterministic hourly pattern — peaks at 10am and 9pm
  const base = [
    12, 8, 5, 3, 2, 3, 6, 14, 28, 38, 42, 40, 35, 30, 32, 34, 36, 38, 42, 45,
    40, 32, 22, 16,
  ]
  return base.map((v, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    requests: v * 7 + Math.floor((i * 137) % 41),
  }))
}

function buildStats30d(): StatsPeriod {
  const totalQuota = flowSeries.reduce((s, f) => s + f.consume, 0)
  const totalRequests = flowSeries.reduce((s, f) => s + f.requests, 0)
  // Derive average latency from log data
  const consumeLogs = logs.filter((l) => l.type === 'consume' && l.latency > 0)
  const avgLatency = consumeLogs.length
    ? Math.round(
        (consumeLogs.reduce((s, l) => s + l.latency, 0) / consumeLogs.length) *
          100
      ) / 100
    : 2.4
  const errorLogs = logs.filter((l) => l.type === 'error')
  const successRate =
    consumeLogs.length + errorLogs.length > 0
      ? Math.round(
          (consumeLogs.length / (consumeLogs.length + errorLogs.length)) * 1000
        ) / 10
      : 98.5

  const totalTokens = consumeLogs.reduce(
    (s, l) => s + l.prompt_tokens + l.completion_tokens,
    0
  )

  const shareTotal = modelShare.reduce((s, m) => s + m.ratio, 0)
  const models = modelShare.map((m) => ({
    model: m.model,
    tokens: Math.round((m.ratio / shareTotal) * totalTokens),
    quota: m.quota,
    requests: Math.round((m.ratio / shareTotal) * totalRequests),
    share: Math.round((m.ratio / shareTotal) * 1000) / 10,
    avgLatency:
      consumeLogs
        .filter(() => true) // all logs contribute to per-model estimate
        .slice(0, 3)
        .reduce((s, l) => s + l.latency, 0) / 3 || avgLatency,
  }))

  return {
    kpi: {
      totalTokens,
      totalQuota,
      totalRequests,
      avgLatency,
      successRate,
    },
    models,
    hourly: buildHourly(),
    flow: flowSeries,
  }
}

function buildStatsToday(): StatsPeriod {
  const base = buildStats30d()
  return {
    ...base,
    kpi: {
      totalTokens: Math.round(base.kpi.totalTokens / 28),
      totalQuota: dashboardStats.today_quota,
      totalRequests: dashboardStats.today_requests,
      avgLatency: base.kpi.avgLatency,
      successRate: base.kpi.successRate,
    },
    flow: flowSeries.slice(-1),
  }
}

/**
 * Narrows a full-window period down to `slice`. Only spend and requests are
 * stored per day, so tokens and the per-model rows are scaled by the request
 * share the window represents rather than invented.
 */
function withFlowSlice(base: StatsPeriod, slice: FlowPoint[]): StatsPeriod {
  const totalRequests = slice.reduce((s, f) => s + f.requests, 0)
  const totalQuota = slice.reduce((s, f) => s + f.consume, 0)
  const share =
    base.kpi.totalRequests > 0 ? totalRequests / base.kpi.totalRequests : 0

  return {
    kpi: {
      ...base.kpi,
      totalTokens: Math.round(base.kpi.totalTokens * share),
      totalQuota,
      totalRequests,
    },
    models: base.models.map((m) => ({
      ...m,
      tokens: Math.round(m.tokens * share),
      quota: Math.round(m.quota * share),
      requests: Math.round(m.requests * share),
    })),
    hourly: base.hourly,
    flow: slice,
  }
}

function buildStats7d(): StatsPeriod {
  return withFlowSlice(buildStats30d(), flowSeries.slice(-7))
}

/**
 * Maps a 'YYYY-MM-DD' key onto a flowSeries index. The series is keyed MM-DD in
 * UTC while the picker emits local dates, so we count whole days back from
 * today instead of matching strings — that keeps the two calendars from drifting
 * a day apart near midnight.
 */
function indexOfDateKey(key: string): number | null {
  const parts = key.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  const [year, month, day] = parts as [number, number, number]

  const midnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const daysAgo = Math.round(
    (midnight(new Date()) - midnight(new Date(year, month - 1, day))) /
      86_400_000
  )

  const last = flowSeries.length - 1
  return Math.min(last, Math.max(0, last - daysAgo))
}

/**
 * Arbitrary window. Unparseable or out-of-series dates fall back to the full
 * 30-day period rather than returning an empty chart.
 */
export function buildStatsRange(startKey: string, endKey: string): StatsPeriod {
  const base = buildStats30d()
  const from = indexOfDateKey(startKey)
  const to = indexOfDateKey(endKey)
  if (from === null || to === null) return base

  const slice = flowSeries.slice(Math.min(from, to), Math.max(from, to) + 1)
  return slice.length ? withFlowSlice(base, slice) : base
}

export const statsData: Record<string, StatsPeriod> = {
  today: buildStatsToday(),
  '7d': buildStats7d(),
  '30d': buildStats30d(),
}
