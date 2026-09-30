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
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { QuotaDataItem } from '@/features/dashboard/types'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { processChartData } from '../charts'

beforeEach(() => {
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG },
  })
})

afterEach(() => {
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  localStorage.clear()
})

describe('model chart time buckets', () => {
  it.each([
    {
      granularity: 'hour' as const,
      dates: ['2026-09-14T03:00:00', '2026-09-15T12:00:00'],
      times: ['09-14 03:00', '09-15 12:00'],
    },
    {
      granularity: 'day' as const,
      dates: ['2026-09-01T12:00:00', '2026-09-15T12:00:00'],
      times: ['09-01', '09-15'],
    },
    {
      granularity: 'week' as const,
      dates: ['2026-09-14T12:00:00', '2026-09-15T12:00:00'],
      times: ['09-14 - 09-20', '09-15 - 09-21'],
    },
  ])(
    'preserves sparse $granularity buckets and their totals without invented periods',
    ({ granularity, dates, times }) => {
      const rows: QuotaDataItem[] = [
        {
          created_at: new Date(dates[1]).getTime() / 1000,
          model_name: 'model-b',
          quota: 28625679,
          count: 3,
        },
        {
          created_at: new Date(dates[0]).getTime() / 1000,
          model_name: 'model-a',
          quota: 11671440,
          count: 2,
        },
      ]
      const result = processChartData(rows, granularity)
      for (const spec of [result.spec_line, result.spec_area]) {
        const values: Array<{ Time: string; rawQuota: number }> =
          spec.data[0].values
        expect([...new Set(values.map((row) => row.Time))]).toEqual(times)
        expect(values.reduce((sum, row) => sum + Number(row.rawQuota), 0)).toBe(
          40297119
        )
      }
      const trend: Array<{ Time: string; Count: number }> =
        result.spec_model_line.data[0].values
      expect([...new Set(trend.map((row) => row.Time))]).toEqual(times)
      expect(trend.reduce((sum, row) => sum + Number(row.Count), 0)).toBe(5)
      expect(result.totalQuotaDisplay).toBe('$80.59')
      expect(result.totalCountDisplay).toBe('5')
    }
  )

  it('shows a point for a single returned bucket in area and call trend charts', () => {
    const result = processChartData(
      [
        {
          created_at: new Date('2026-09-15T12:00:00').getTime() / 1000,
          model_name: 'model-a',
          quota: 500000,
          count: 2,
        },
      ],
      'day'
    )
    for (const spec of [result.spec_area, result.spec_model_line]) {
      expect(spec.data[0].values).toHaveLength(1)
      expect(spec.point).toEqual({ visible: true })
    }
    expect(result.totalQuotaDisplay).toBe('$1.00')
    expect(result.totalCountDisplay).toBe('2')
  })

  it('keeps empty charts empty with zero totals', () => {
    const result = processChartData([], 'week')
    for (const spec of [
      result.spec_line,
      result.spec_area,
      result.spec_model_line,
    ]) {
      expect(spec.data[0].values).toEqual([])
    }
    expect(result.totalQuotaDisplay).toBe('$0.00')
    expect(result.totalCountDisplay).toBe('0')
  })
})
