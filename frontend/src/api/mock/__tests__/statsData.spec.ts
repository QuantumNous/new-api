import { beforeEach, describe, expect, it } from 'vitest'

import { writeDemoUser } from '@/api/demoStorage'
import { flowSeries, mockUser } from '@/api/mock/data'
import { dispatchMock } from '@/api/mock/handlers'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import { buildStatsRange, statsData } from '@/api/mock/statsData'
import {
  usageDistributionHistory,
  usageHistoryDurationDays,
} from '@/api/mock/usageDistributionData'
import type { FlowPoint } from '@/composables/useDashboard'
import type { StatsPeriod } from '@/composables/useDashboardStats'
import type { UsageDistributionPoint } from '@/composables/useUsageDistribution'

/** 'YYYY-MM-DD' local-time key, N days from today. */
function dateKey(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const full = statsData['30d']!

function toFlow(points: UsageDistributionPoint[]): FlowPoint[] {
  return points.map((point) => ({
    date: point.date.slice(5),
    consume: point.consume,
    requests: point.requests,
    topup: 0,
  }))
}

beforeEach(() => {
  resetMockState()
  setMockDelay(0)
  writeDemoUser({ ...mockUser })
})

describe('buildStatsRange', () => {
  it('returns only the days inside the window', () => {
    const period = buildStatsRange(dateKey(-6), dateKey(0))

    expect(period.flow).toHaveLength(7)
    expect(period.flow).toEqual(toFlow(usageDistributionHistory.slice(-7)))
  })

  it('sums spend and requests from the window rather than the full period', () => {
    const period = buildStatsRange(dateKey(-6), dateKey(0))
    const slice = usageDistributionHistory.slice(-7)

    expect(period.kpi.totalQuota).toBe(slice.reduce((s, f) => s + f.consume, 0))
    expect(period.kpi.totalRequests).toBe(
      slice.reduce((s, f) => s + f.requests, 0)
    )
    expect(period.kpi.totalRequests).toBeLessThan(full.kpi.totalRequests)
  })

  it('scales tokens and per-model rows down with the window', () => {
    const period = buildStatsRange(dateKey(-6), dateKey(0))

    expect(period.kpi.totalTokens).toBeLessThan(full.kpi.totalTokens)
    expect(period.models).toHaveLength(full.models.length)
    period.models.forEach((row, i) => {
      expect(row.tokens).toBeLessThanOrEqual(full.models[i]!.tokens)
      expect(row.requests).toBeLessThanOrEqual(full.models[i]!.requests)
    })
  })

  it('accepts a reversed window', () => {
    const forward = buildStatsRange(dateKey(-6), dateKey(0))
    const reversed = buildStatsRange(dateKey(0), dateKey(-6))

    expect(reversed.flow).toEqual(forward.flow)
  })

  it('clamps dates that fall outside the series instead of emptying the chart', () => {
    const period = buildStatsRange(dateKey(-900), dateKey(900))

    expect(period.flow).toEqual(toFlow(usageDistributionHistory))
    expect(period.flow).toHaveLength(365)
  })

  it('falls back to the full period on unparseable input', () => {
    expect(buildStatsRange('', '').flow).toEqual(full.flow)
    expect(buildStatsRange('not-a-date', dateKey(0)).flow).toEqual(full.flow)
  })

  it('returns a single day when both ends are the same', () => {
    const period = buildStatsRange(dateKey(0), dateKey(0))

    expect(period.flow).toHaveLength(1)
    expect(period.flow[0]).toEqual(
      toFlow(usageDistributionHistory.slice(-1))[0]
    )
  })
})

describe('statsData presets', () => {
  it('no longer ships a placeholder custom preset', () => {
    expect(statsData.custom).toBeUndefined()
  })

  it('narrows the 7-day preset the same way an explicit range does', () => {
    expect(statsData['7d']!.flow).toEqual(
      buildStatsRange(dateKey(-6), dateKey(0)).flow
    )
    expect(statsData['7d']!.kpi.totalRequests).toBe(
      buildStatsRange(dateKey(-6), dateKey(0)).kpi.totalRequests
    )
  })

  it('keeps the public 30-day flow values unchanged', () => {
    expect(
      usageDistributionHistory.slice(-30).map((point) => point.consume)
    ).toEqual(flowSeries.map((point) => point.consume))
    expect(
      usageDistributionHistory.slice(-30).map((point) => point.requests)
    ).toEqual(flowSeries.map((point) => point.requests))
  })

  it('compares each preset with the preceding equal-length period', () => {
    const current = usageDistributionHistory.slice(-7)
    const previous = usageDistributionHistory.slice(-14, -7)
    const currentRequests = current.reduce(
      (sum, point) => sum + point.requests,
      0
    )
    const previousRequests = previous.reduce(
      (sum, point) => sum + point.requests,
      0
    )
    const expected =
      Math.round(
        ((currentRequests - previousRequests) / previousRequests) * 1000
      ) / 10

    expect(statsData['7d']!.comparison.requestsDelta).toBe(expected)
  })

  it('omits comparisons when no equal previous window exists', () => {
    const first = usageDistributionHistory[0]!.date
    const period = buildStatsRange(first, first)

    expect(period.comparison).toEqual({ quotaDelta: null, requestsDelta: null })
  })
})

const AUTH = { headers: { 'X-Ren2Hub-Demo-User': '1' } }

function ctx(params: Record<string, unknown>) {
  return { ...AUTH, params, data: {} }
}

describe('GET /api/data/stats', () => {
  it('forwards start and end through to the custom window', async () => {
    const res = await dispatchMock<StatsPeriod>(
      'GET',
      '/api/data/stats',
      ctx({ range: 'custom', start: dateKey(-6), end: dateKey(0) })
    )

    expect(res.success).toBe(true)
    expect(res.data!.flow).toEqual(toFlow(usageDistributionHistory.slice(-7)))
  })

  it('serves the preset periods by key', async () => {
    const res = await dispatchMock<StatsPeriod>(
      'GET',
      '/api/data/stats',
      ctx({ range: 'today' })
    )

    expect(res.data!.flow).toHaveLength(1)
  })

  it('falls back to 30 days for an unknown range key', async () => {
    const res = await dispatchMock<StatsPeriod>(
      'GET',
      '/api/data/stats',
      ctx({ range: 'nonsense' })
    )

    expect(res.data!.flow).toEqual(full.flow)
  })

  it('serves one deterministic year to the distribution card', async () => {
    const res = await dispatchMock<UsageDistributionPoint[]>(
      'GET',
      '/api/data/distribution/self',
      ctx({})
    )

    expect(res.success).toBe(true)
    expect(res.data).toEqual(usageDistributionHistory)
    expect(usageHistoryDurationDays()).toBe(365)
  })
})
