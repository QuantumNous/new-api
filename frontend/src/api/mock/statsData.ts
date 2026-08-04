/** Mock statistics data derived from the same daily history as the heatmap. */
import { logs, modelShare } from './data'
import { usageDistributionHistory } from './usageDistributionData'
import type { FlowPoint } from '@/composables/useDashboard'
import type {
  HourlyPoint,
  StatsComparison,
  StatsPeriod,
} from '@/composables/useDashboardStats'
import type { UsageDistributionPoint } from '@/composables/useUsageDistribution'

function buildHourly(): HourlyPoint[] {
  const base = [
    12, 8, 5, 3, 2, 3, 6, 14, 28, 38, 42, 40, 35, 30, 32, 34, 36, 38, 42, 45,
    40, 32, 22, 16,
  ]
  return base.map((value, hour) => ({
    hour: `${String(hour).padStart(2, '0')}:00`,
    requests: value * 7 + Math.floor((hour * 137) % 41),
  }))
}

function percentDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function comparisonFor(
  current: UsageDistributionPoint[],
  previous: UsageDistributionPoint[]
): StatsComparison {
  if (current.length === 0 || current.length !== previous.length) {
    return { quotaDelta: null, requestsDelta: null }
  }

  const currentQuota = current.reduce((sum, point) => sum + point.consume, 0)
  const previousQuota = previous.reduce((sum, point) => sum + point.consume, 0)
  const currentRequests = current.reduce(
    (sum, point) => sum + point.requests,
    0
  )
  const previousRequests = previous.reduce(
    (sum, point) => sum + point.requests,
    0
  )
  return {
    quotaDelta: percentDelta(currentQuota, previousQuota),
    requestsDelta: percentDelta(currentRequests, previousRequests),
  }
}

function toFlow(points: UsageDistributionPoint[]): FlowPoint[] {
  return points.map((point) => ({
    date: point.date.slice(5),
    consume: point.consume,
    requests: point.requests,
    topup: 0,
  }))
}

function buildStatsPeriod(
  points: UsageDistributionPoint[],
  previous: UsageDistributionPoint[]
): StatsPeriod {
  const totalQuota = points.reduce((sum, point) => sum + point.consume, 0)
  const totalRequests = points.reduce((sum, point) => sum + point.requests, 0)
  const totalTokens = points.reduce((sum, point) => sum + point.tokens, 0)
  const consumeLogs = logs.filter(
    (log) => log.type === 'consume' && log.latency > 0
  )
  const errorLogs = logs.filter((log) => log.type === 'error')
  const avgLatency = consumeLogs.length
    ? Math.round(
        (consumeLogs.reduce((sum, log) => sum + log.latency, 0) /
          consumeLogs.length) *
          100
      ) / 100
    : 0
  const successRate =
    consumeLogs.length + errorLogs.length > 0
      ? Math.round(
          (consumeLogs.length / (consumeLogs.length + errorLogs.length)) * 1000
        ) / 10
      : 0

  const quotaBase = modelShare.reduce((sum, model) => sum + model.quota, 0)
  const requestBase = modelShare.reduce((sum, model) => sum + model.requests, 0)
  const tokenBase = modelShare.reduce((sum, model) => sum + model.tokens, 0)
  const models = modelShare.map((model) => {
    const quota = quotaBase
      ? Math.round((model.quota / quotaBase) * totalQuota)
      : 0
    return {
      model: model.model,
      tokens: tokenBase
        ? Math.round((model.tokens / tokenBase) * totalTokens)
        : 0,
      quota,
      requests: requestBase
        ? Math.round((model.requests / requestBase) * totalRequests)
        : 0,
      share: totalQuota ? Math.round((quota / totalQuota) * 1000) / 10 : 0,
      avgLatency,
    }
  })

  return {
    kpi: {
      totalTokens,
      totalQuota,
      totalRequests,
      avgLatency,
      successRate,
    },
    comparison: comparisonFor(points, previous),
    models,
    hourly: buildHourly(),
    flow: toFlow(points),
  }
}

function recentPeriod(days: number): StatsPeriod {
  const end = usageDistributionHistory.length
  const start = Math.max(0, end - days)
  const previousStart = Math.max(0, start - days)
  return buildStatsPeriod(
    usageDistributionHistory.slice(start, end),
    usageDistributionHistory.slice(previousStart, start)
  )
}

function validDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
}

export function buildStatsRange(startKey: string, endKey: string): StatsPeriod {
  if (!validDateKey(startKey) || !validDateKey(endKey)) return recentPeriod(30)
  const [from, to] =
    startKey <= endKey ? [startKey, endKey] : [endKey, startKey]
  const first = usageDistributionHistory.findIndex(
    (point) => point.date >= from
  )
  let last = -1
  for (let index = usageDistributionHistory.length - 1; index >= 0; index--) {
    if (usageDistributionHistory[index]!.date <= to) {
      last = index
      break
    }
  }
  if (first < 0 || last < first) return recentPeriod(30)

  const points = usageDistributionHistory.slice(first, last + 1)
  const previousStart = Math.max(0, first - points.length)
  const previous = usageDistributionHistory.slice(previousStart, first)
  return buildStatsPeriod(points, previous)
}

export const statsData: Record<string, StatsPeriod> = {
  today: recentPeriod(1),
  '7d': recentPeriod(7),
  '30d': recentPeriod(30),
}
