/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, it } from 'vitest'

import {
  buildDailyRevenue,
  buildHourlyActiveUsers,
  buildModelUsage,
  buildTodayTokenSeries,
  countActiveUsers,
  sumUsage,
  sumUsageSince,
} from '../lib/aggregate'
import type { OverviewQuotaRow, OverviewUserRow } from '../types'

function timestampDaysAgo(days: number, hour = 12): number {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return Math.floor(date.getTime() / 1000)
}

describe('admin overview aggregation', () => {
  it('keeps quota, token and request sums as exact integers', () => {
    const rows: OverviewQuotaRow[] = [
      { created_at: 1, quota: 1_500_000, token_used: 1200, count: 3 },
      { created_at: 2, quota: 500, token_used: 0, count: 1 },
      { created_at: 3, quota: Number.NaN, token_used: -4, count: 2 },
    ]

    expect(sumUsage(rows)).toEqual({
      quota: 1_500_500,
      tokens: 1200,
      requests: 6,
    })
  })

  it('filters rows before the requested start timestamp', () => {
    const rows: OverviewQuotaRow[] = [
      { created_at: 100, quota: 10, token_used: 1, count: 1 },
      { created_at: 200, quota: 20, token_used: 2, count: 2 },
      { created_at: 300, quota: 30, token_used: 3, count: 3 },
    ]

    expect(sumUsageSince(rows, 200)).toEqual({
      quota: 50,
      tokens: 5,
      requests: 5,
    })
  })

  it('buckets revenue into the last 30 local days without losing precision', () => {
    const rows: OverviewQuotaRow[] = [
      { created_at: timestampDaysAgo(0), quota: 500_000 },
      { created_at: timestampDaysAgo(0), quota: 250_000 },
      { created_at: timestampDaysAgo(1), quota: 100 },
      { created_at: timestampDaysAgo(40), quota: 999 },
    ]

    const points = buildDailyRevenue(rows, 30)

    expect(points).toHaveLength(30)
    expect(points.at(-1)?.quota).toBe(750_000)
    expect(points.at(-2)?.quota).toBe(100)
    expect(points.every((point) => Number.isInteger(point.quota))).toBe(true)
  })

  it('merges rows per model and orders them by token usage', () => {
    const rows: OverviewQuotaRow[] = [
      {
        created_at: timestampDaysAgo(0),
        model_name: 'gpt-4o',
        quota: 100,
        token_used: 10,
        count: 1,
      },
      {
        created_at: timestampDaysAgo(0),
        model_name: 'gpt-4o',
        quota: 100,
        token_used: 20,
        count: 2,
      },
      {
        created_at: timestampDaysAgo(0),
        model_name: 'claude',
        quota: 300,
        token_used: 40,
        count: 4,
      },
    ]

    expect(buildModelUsage(rows)).toEqual([
      { model: 'claude', quota: 300, tokens: 40, requests: 4 },
      { model: 'gpt-4o', quota: 200, tokens: 30, requests: 3 },
    ])
  })

  it('groups today token usage per hour with top models and an other series', () => {
    const todayStart = timestampDaysAgo(0, 0)
    const rows: OverviewQuotaRow[] = Array.from({ length: 6 }, (_, index) => ({
      created_at: timestampDaysAgo(0, 9),
      model_name: `model-${index}`,
      token_used: 100 - index * 10,
      count: 1,
      quota: 10,
    }))

    const result = buildTodayTokenSeries(rows, todayStart, 23, 5)

    expect(result.series).toHaveLength(6)
    expect(result.series.at(-1)?.model).toBe('Other')
    expect(result.points).toHaveLength(24)
    expect(result.points[9]?.label).toBe('09:00')
    expect(result.points[9]?.total).toBe(450)
    expect(result.points[9]?.values.other).toBe(50)
  })

  it('counts distinct active users and their hourly presence', () => {
    const now = new Date(2026, 10, 6, 12, 30, 0)
    const currentHourStart = new Date(now)
    currentHourStart.setMinutes(0, 0, 0)
    const previousHour = Math.floor(currentHourStart.getTime() / 1000) - 3600
    const rows: OverviewUserRow[] = [
      { username: 'alice', created_at: previousHour },
      { username: 'alice', created_at: previousHour },
      { username: 'bob', created_at: previousHour },
      { username: '   ', created_at: previousHour },
    ]

    expect(countActiveUsers(rows)).toBe(2)

    const points = buildHourlyActiveUsers(rows, now)
    expect(points).toHaveLength(24)
    expect(points[22]).toEqual({ label: '11:00', activeUsers: 2 })
    expect(points[23]).toEqual({ label: '12:00', activeUsers: 0 })
  })
})
