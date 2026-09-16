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

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { processChartData } from '../charts'

const initialState = useSystemConfigStore.getState()

beforeEach(() => {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})

afterEach(() => {
  useSystemConfigStore.setState(initialState, true)
  localStorage.clear()
})

describe('model chart time buckets', () => {
  it.each([
    ['hour', ['09-14 12:00', '09-15 12:00']],
    ['day', ['09-14', '09-15']],
    ['week', ['09-14 - 09-20', '09-15 - 09-21']],
  ] as const)(
    'preserves sparse %s buckets and their quota and call totals',
    (granularity, times) => {
      const result = processChartData(
        [
          {
            created_at: new Date(2026, 8, 15, 12).getTime() / 1000,
            model_name: 'model-a',
            quota: 1500000,
            count: 3,
          },
          {
            created_at: new Date(2026, 8, 14, 12).getTime() / 1000,
            model_name: 'model-a',
            quota: 500000,
            count: 1,
          },
          {
            created_at: new Date(2026, 8, 14, 12).getTime() / 1000,
            model_name: 'model-a',
            quota: 500000,
            count: 1,
          },
        ],
        granularity
      )

      for (const spec of [result.spec_line, result.spec_area]) {
        expect(spec.data[0].values).toEqual([
          {
            Time: times[0],
            Model: 'model-a',
            rawQuota: 1000000,
            Usage: 2,
            TimeSum: 1000000,
          },
          {
            Time: times[1],
            Model: 'model-a',
            rawQuota: 1500000,
            Usage: 3,
            TimeSum: 1500000,
          },
        ])
      }
      expect(result.spec_model_line.data[0].values).toEqual([
        { Time: times[0], Model: 'model-a', Count: 2 },
        { Time: times[1], Model: 'model-a', Count: 3 },
      ])
      expect(result.totalQuotaDisplay).toBe('$5.00')
      expect(result.totalCountDisplay).toBe('5')
    }
  )

  it('shows a visible point for a single bucket without inventing earlier periods', () => {
    const result = processChartData([
      {
        created_at: new Date(2026, 8, 15, 12).getTime() / 1000,
        model_name: 'model-a',
        quota: 500000,
        count: 1,
      },
    ])

    for (const spec of [
      result.spec_line,
      result.spec_area,
      result.spec_model_line,
    ]) {
      expect(spec.data[0].values).toHaveLength(1)
      expect(spec.data[0].values[0].Time).toBe('09-15')
    }
    expect(result.spec_area.point.visible).toBe(true)
    expect(result.spec_model_line.point.visible).toBe(true)
  })

  it('keeps charts empty when no usage rows are returned', () => {
    const result = processChartData([])

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
