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
import { describe, expect, test } from 'vitest'

import type { QuotaDataItem } from '@/features/dashboard/types'
import type { TimeGranularity } from '@/lib/time'

import { processChartData, processUserChartData } from '../charts'

const cases: Array<{
  granularity: TimeGranularity
  start: string
  interval: number
  labels: string[]
}> = [
  {
    granularity: 'hour',
    start: '2025-12-31T20:00:00',
    interval: 3600,
    labels: [
      '12-31 20:00',
      '12-31 21:00',
      '12-31 22:00',
      '12-31 23:00',
      '01-01 00:00',
      '01-01 01:00',
      '01-01 02:00',
      '01-01 03:00',
    ],
  },
  {
    granularity: 'day',
    start: '2025-12-27T12:00:00',
    interval: 86400,
    labels: [
      '12-27',
      '12-28',
      '12-29',
      '12-30',
      '12-31',
      '01-01',
      '01-02',
      '01-03',
    ],
  },
  {
    granularity: 'week',
    start: '2025-11-29T12:00:00',
    interval: 604800,
    labels: [
      '11-29 - 12-05',
      '12-06 - 12-12',
      '12-13 - 12-19',
      '12-20 - 12-26',
      '12-27 - 01-02',
      '01-03 - 01-09',
      '01-10 - 01-16',
      '01-17 - 01-23',
    ],
  },
]

function unorderedUsage(start: string, interval: number): QuotaDataItem[] {
  const first = new Date(start).getTime() / 1000
  const rows = Array.from({ length: 8 }, (_, i) => ({
    created_at: first + i * interval,
    model_name: 'model-a',
    username: 'alice',
    quota: (i + 1) * 500000,
    count: i + 1,
  }))
  // Same hour, or a second hourly record within the same day/week label.
  const duplicate = {
    ...rows[0],
    created_at: first + (interval === 3600 ? 0 : 3600),
    quota: 5000000,
    count: 10,
  }
  return [
    rows[7],
    rows[2],
    duplicate,
    rows[5],
    rows[0],
    rows[6],
    rows[1],
    rows[4],
    rows[3],
  ]
}

describe.each(cases)('dashboard $granularity chart chronology', (scenario) => {
  test('orders model buckets across New Year while aggregating repeated labels', () => {
    const data = unorderedUsage(scenario.start, scenario.interval)
    const original = structuredClone(data)
    const result = processChartData(data, scenario.granularity)

    for (const key of ['spec_line', 'spec_area', 'spec_model_line'] as const) {
      const values: Array<{ Time: string; rawQuota: number; Count: number }> =
        result[key].data[0].values
      expect(values.map((row) => row.Time)).toEqual(scenario.labels)
      expect(
        values.map((row) =>
          key === 'spec_model_line' ? row.Count : row.rawQuota / 500000
        )
      ).toEqual([11, 2, 3, 4, 5, 6, 7, 8])
    }
    expect(data).toEqual(original)
  })

  test('orders user buckets across New Year while aggregating repeated labels', () => {
    const data = unorderedUsage(scenario.start, scenario.interval)
    const original = structuredClone(data)
    const result = processUserChartData(data, scenario.granularity)
    const values: Array<{ Time: string; rawQuota: number }> =
      result.spec_user_trend.data[0].values

    expect(values.map((row) => row.Time)).toEqual(scenario.labels)
    expect(values.map((row) => row.rawQuota / 500000)).toEqual([
      11, 2, 3, 4, 5, 6, 7, 8,
    ])
    expect(data).toEqual(original)
  })

  test('keeps the existing seven padded model buckets in chronological order', () => {
    const data = [unorderedUsage(scenario.start, scenario.interval)[0]]
    const result = processChartData(data, scenario.granularity)

    for (const key of ['spec_line', 'spec_area', 'spec_model_line'] as const) {
      const values: Array<{ Time: string; rawQuota: number; Count: number }> =
        result[key].data[0].values
      expect(values.map((row) => row.Time)).toEqual(scenario.labels.slice(1))
      expect(
        values.map((row) =>
          key === 'spec_model_line' ? row.Count : row.rawQuota / 500000
        )
      ).toEqual([0, 0, 0, 0, 0, 0, 8])
    }
  })
})

describe('dashboard user display names', () => {
  test('shows display names while keeping same-name accounts in separate series', () => {
    const result = processUserChartData([
      {
        user_id: 1,
        username: 'alice',
        display_name: '同名',
        created_at: 3600,
        quota: 50,
      },
      {
        user_id: 2,
        username: 'bob',
        display_name: '同名',
        created_at: 3600,
        quota: 30,
      },
    ])
    const rank = result.spec_user_rank
    const values = rank.data[0].values
    expect(values.map((row: { rawQuota: number }) => row.rawQuota)).toEqual([
      50, 30,
    ])
    expect(new Set(values.map((row: { User: string }) => row.User)).size).toBe(
      2
    )
    const label = rank.axes[0].label.formatMethod
    expect(values.map((row: { User: string }) => label(row.User))).toEqual([
      '同名 (alice)',
      '同名 (bob)',
    ])
    const legend = result.spec_user_trend.legends.item.label.formatMethod
    expect(legend(values[0].User)).toBe('同名 (alice)')
  })

  test('merges renamed history by user ID and exposes the username in the tooltip', () => {
    const result = processUserChartData(
      [
        {
          user_id: 1,
          username: 'old-login',
          display_name: 'Alice',
          created_at: 3600,
          quota: 50,
        },
        {
          user_id: 1,
          username: 'new-login',
          display_name: 'Alice',
          created_at: 7200,
          quota: 30,
        },
      ],
      'day'
    )
    const rank = result.spec_user_rank
    expect(rank.data[0].values).toHaveLength(1)
    const row = rank.data[0].values[0]
    expect(row.rawQuota).toBe(80)
    expect(rank.axes[0].label.formatMethod(row.User)).toBe('Alice')
    expect(rank.tooltip.mark.content[0].key(row)).toBe('Alice (new-login)')
    expect(result.spec_user_trend.data[0].values[0].rawQuota).toBe(80)
  })

  test('falls back to usernames for blank names and legacy rows without IDs', () => {
    const result = processUserChartData([
      {
        user_id: 1,
        username: 'alice',
        display_name: '  ',
        created_at: 3600,
        quota: 50,
      },
      { username: 'legacy-a', created_at: 3600, quota: 30 },
      { user_id: 0, username: 'legacy-b', created_at: 3600, quota: 20 },
    ])
    const rank = result.spec_user_rank
    expect(
      rank.data[0].values.map((row: { User: string }) =>
        rank.axes[0].label.formatMethod(row.User)
      )
    ).toEqual(['alice', 'legacy-a', 'legacy-b'])
  })

  test('keeps natural label collisions separate and preserves top-user limits', () => {
    const result = processUserChartData(
      [
        {
          user_id: 1,
          username: 'alice',
          display_name: 'Same',
          created_at: 3600,
          quota: 50,
        },
        {
          user_id: 2,
          username: 'bob',
          display_name: 'Same',
          created_at: 3600,
          quota: 30,
        },
        {
          user_id: 3,
          username: 'charlie',
          display_name: 'Same (alice)',
          created_at: 3600,
          quota: 20,
        },
      ],
      'day',
      undefined,
      3
    )
    const rank = result.spec_user_rank
    expect(rank.data[0].values).toHaveLength(3)
    expect(
      new Set(rank.data[0].values.map((row: { User: string }) => row.User)).size
    ).toBe(3)
    const labels = rank.data[0].values.map((row: { User: string }) =>
      rank.axes[0].label.formatMethod(row.User)
    )
    expect(new Set(labels).size).toBe(3)
    expect(
      processUserChartData([], 'day').spec_user_rank.data[0].values
    ).toEqual([])
    expect(
      processUserChartData(
        [
          { user_id: 1, username: 'alice', created_at: 3600, quota: 50 },
          { user_id: 2, username: 'bob', created_at: 3600, quota: 30 },
        ],
        'day',
        undefined,
        1
      ).spec_user_rank.data[0].values
    ).toHaveLength(1)
  })
})
