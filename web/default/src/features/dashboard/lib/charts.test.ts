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
import { describe, expect, it, vi } from 'vitest'

import type { QuotaDataItem } from '../types'
import { processChartData, processUserChartData } from './charts'

vi.mock('@/i18n/languages', () => ({
  getCurrentIntlLocale: () => 'vi-VN',
}))

const timestamp = (iso: string) => new Date(iso).getTime() / 1000

const seriesPoints = (
  rows: Array<Record<string, string | number>>,
  seriesKey: string
) =>
  rows
    .filter((row) => Number(row[seriesKey]) > 0)
    .map((row) => ({ time: String(row.Time), value: Number(row[seriesKey]) }))

describe('dashboard chart chronology', () => {
  const data: QuotaDataItem[] = [
    {
      created_at: timestamp('2026-07-31T00:00:00Z'),
      username: 'alice',
      model_name: 'model-a',
      quota: 10,
      count: 1,
    },
    {
      created_at: timestamp('2026-07-31T12:00:00Z'),
      username: 'alice',
      model_name: 'model-a',
      quota: 5,
      count: 2,
    },
    {
      created_at: timestamp('2026-08-01T00:00:00Z'),
      username: 'alice',
      model_name: 'model-a',
      quota: 20,
      count: 1,
    },
  ]

  it('keeps model trend points chronological across month boundaries', () => {
    const result = processChartData(data, 'day')

    expect(result.trendCount.xKey).toBe('Time')
    expect(result.trendCount.seriesKeys).toEqual(['model-a'])
    expect(seriesPoints(result.trendCount.rows, 'model-a')).toEqual([
      { time: '31-07', value: 3 },
      { time: '01-08', value: 1 },
    ])
  })

  it('keeps user trend points chronological across month boundaries', () => {
    const result = processUserChartData(data, 'day')

    expect(result.trend.seriesKeys).toEqual(['alice'])
    expect(
      result.trend.rows.map(
        (row) => result.trend.rawByKey?.[`${String(row.Time)}::alice`]
      )
    ).toEqual([15, 20])
  })

  it('pads daily and weekly charts from normalized calendar buckets', () => {
    const daily = processChartData(
      [
        {
          created_at: timestamp('2026-08-01T12:00:00Z'),
          model_name: 'model-a',
          quota: 25,
          count: 2,
        },
      ],
      'day'
    )
    expect(seriesPoints(daily.trendCount.rows, 'model-a')).toEqual([
      { time: '01-08', value: 2 },
    ])

    const weekly = processChartData(
      [
        {
          created_at: timestamp('2026-08-05T12:00:00Z'),
          model_name: 'model-a',
          quota: 30,
          count: 3,
        },
      ],
      'week'
    )
    expect(
      seriesPoints(weekly.trendCount.rows, 'model-a').map((item) => item.value)
    ).toEqual([3])
  })

  it('keeps distinct absolute hourly buckets', () => {
    const result = processChartData(
      [
        {
          created_at: timestamp('2026-11-01T05:30:00Z'),
          model_name: 'model-a',
          count: 1,
        },
        {
          created_at: timestamp('2026-11-01T06:30:00Z'),
          model_name: 'model-a',
          count: 2,
        },
      ],
      'hour'
    )

    expect(
      seriesPoints(result.trendCount.rows, 'model-a').map((item) => item.value)
    ).toEqual([1, 2])
  })
})

describe('dashboard chart aggregation shape', () => {
  const data: QuotaDataItem[] = [
    {
      created_at: timestamp('2026-08-01T01:00:00Z'),
      model_name: 'model-a',
      quota: 100,
      count: 3,
    },
    {
      created_at: timestamp('2026-08-01T01:00:00Z'),
      model_name: 'model-b',
      quota: 40,
      count: 1,
    },
    {
      created_at: timestamp('2026-08-01T02:00:00Z'),
      model_name: 'model-b',
      quota: 60,
      count: 5,
    },
  ]

  it('ranks pie and rank rows by call count with a color per row', () => {
    const result = processChartData(data, 'hour')

    expect(result.pie.rows.map((row) => [row.name, row.value])).toEqual([
      ['model-b', 6],
      ['model-a', 3],
    ])
    expect(result.pie.rows.every((row) => row.fill.length > 0)).toBe(true)
    expect(result.rankCount.rows.map((row) => row.name)).toEqual([
      'model-b',
      'model-a',
    ])
    expect(result.rankCount.valueKind).toBe('count')
  })

  it('pivots quota series to one row per bucket with every series filled', () => {
    const result = processChartData(data, 'hour')
    const rows = result.stackedQuota.rows

    expect(result.stackedQuota.seriesKeys).toEqual(['model-a', 'model-b'])
    expect(result.stackedQuota.stacked).toBe(true)
    expect(rows.every((row) => 'model-a' in row && 'model-b' in row)).toBe(true)

    const bucket = rows.find((row) => row['model-a'] !== 0)
    expect(bucket).toBeDefined()
    const bucketTime = String(bucket?.Time)
    expect(result.stackedQuota.rawByKey?.[`${bucketTime}::model-a`]).toBe(100)
    expect(result.stackedQuota.rawByKey?.[`${bucketTime}::model-b`]).toBe(40)
  })

  it('reports user ranking totals and colors for the top users', () => {
    const result = processUserChartData(
      [
        {
          created_at: timestamp('2026-08-01T01:00:00Z'),
          username: 'alice',
          quota: 100,
          count: 1,
        },
        {
          created_at: timestamp('2026-08-01T01:00:00Z'),
          username: 'bob',
          quota: 300,
          count: 1,
        },
      ],
      'hour'
    )

    expect(result.rank.rows.map((row) => row.name)).toEqual(['bob', 'alice'])
    expect(result.rank.layout).toBe('vertical')
    expect(result.rank.valueKind).toBe('quota')
    expect(new Set(result.rank.rows.map((row) => row.fill)).size).toBe(2)
    expect(result.trend.seriesKeys).toEqual(['bob', 'alice'])
  })
})

describe('empty dashboard chart data', () => {
  it('returns empty rows with titles instead of undefined charts', () => {
    const result = processChartData([], 'day')

    expect(result.pie.rows).toEqual([])
    expect(result.stackedQuota.rows).toEqual([])
    expect(result.stackedQuota.seriesKeys).toEqual([])
    expect(result.trendCount.valueKind).toBe('count')
    expect(result.rankCount.rows).toEqual([])
    expect(result.pie.title.length).toBeGreaterThan(0)

    const users = processUserChartData([], 'day')
    expect(users.rank.rows).toEqual([])
    expect(users.trend.rows).toEqual([])
  })
})
