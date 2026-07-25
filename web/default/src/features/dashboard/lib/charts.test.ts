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
    const values = result.spec_model_line.data[0].values as Array<{
      Time: string
      Count: number
    }>

    expect(
      values
        .filter((item) => item.Count > 0)
        .map((item) => ({ time: item.Time, count: item.Count }))
    ).toEqual([
      { time: '31-07', count: 3 },
      { time: '01-08', count: 1 },
    ])
  })

  it('keeps user trend points chronological across month boundaries', () => {
    const result = processUserChartData(data, 'day')
    const values = result.spec_user_trend.data[0].values as Array<{
      Time: string
      rawQuota: number
    }>

    expect(values.map((item) => item.rawQuota)).toEqual([15, 20])
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
    const dailyValues = daily.spec_model_line.data[0].values as Array<{
      Count: number
    }>
    expect(dailyValues.filter((item) => item.Count > 0)).toEqual([
      expect.objectContaining({ Count: 2 }),
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
    const weeklyValues = weekly.spec_model_line.data[0].values as Array<{
      Count: number
    }>
    expect(weeklyValues.filter((item) => item.Count > 0)).toEqual([
      expect.objectContaining({ Count: 3 }),
    ])
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
    const values = result.spec_model_line.data[0].values as Array<{
      Count: number
    }>
    expect(
      values.filter((item) => item.Count > 0).map((item) => item.Count)
    ).toEqual([1, 2])
  })
})
