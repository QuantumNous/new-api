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

import type { TimeGranularity } from '@/lib/time'

import type { QuotaDataItem } from '../../types'
import { processChartData, processUserChartData } from '../charts'

type ChartSpec = { data: Array<{ values: Array<{ Time: string }> }> }

// Local-time seconds, so the labels do not depend on the test machine's time zone.
function at(year: number, month: number, day: number, hour = 0): number {
  return new Date(year, month - 1, day, hour).getTime() / 1000
}

function rows(timestamps: number[]): QuotaDataItem[] {
  return timestamps.map((created_at) => ({
    created_at,
    model_name: 'gpt-4.1',
    username: 'alice',
    quota: 1000,
    count: 1,
    token_used: 10,
  }))
}

function timeOrder(spec: unknown): string[] {
  const values = (spec as ChartSpec).data[0].values
  return [...new Set(values.map((item) => item.Time))]
}

const cases: Array<{
  granularity: TimeGranularity
  timestamps: number[]
  expected: string[]
}> = [
  {
    granularity: 'day',
    timestamps: [
      at(2025, 12, 29),
      at(2025, 12, 30),
      at(2025, 12, 31),
      at(2026, 1, 1),
      at(2026, 1, 2),
      at(2026, 1, 3),
    ],
    expected: ['12-28', '12-29', '12-30', '12-31', '01-01', '01-02', '01-03'],
  },
  {
    granularity: 'hour',
    timestamps: [
      at(2025, 12, 31, 22),
      at(2025, 12, 31, 23),
      at(2026, 1, 1, 0),
      at(2026, 1, 1, 1),
      at(2026, 1, 1, 2),
      at(2026, 1, 1, 3),
      at(2026, 1, 1, 4),
    ],
    expected: [
      '12-31 22:00',
      '12-31 23:00',
      '01-01 00:00',
      '01-01 01:00',
      '01-01 02:00',
      '01-01 03:00',
      '01-01 04:00',
    ],
  },
  {
    granularity: 'week',
    timestamps: [
      at(2025, 11, 24),
      at(2025, 12, 1),
      at(2025, 12, 8),
      at(2025, 12, 15),
      at(2025, 12, 22),
      at(2025, 12, 29),
      at(2026, 1, 5),
    ],
    expected: [
      '11-24 - 11-30',
      '12-01 - 12-07',
      '12-08 - 12-14',
      '12-15 - 12-21',
      '12-22 - 12-28',
      '12-29 - 01-04',
      '01-05 - 01-11',
    ],
  },
]

describe('dashboard chart time order across a year boundary', () => {
  test.each(cases)(
    'model charts with $granularity granularity keep December before January',
    ({ granularity, timestamps, expected }) => {
      const result = processChartData(rows(timestamps), granularity)

      expect(timeOrder(result.spec_line)).toEqual(expected)
      expect(timeOrder(result.spec_area)).toEqual(expected)
      expect(timeOrder(result.spec_model_line)).toEqual(expected)
    }
  )

  test.each(cases)(
    'user trend with $granularity granularity keeps December before January',
    ({ granularity, timestamps, expected }) => {
      const result = processUserChartData(rows(timestamps), granularity)

      // The user trend is not padded, so it only has the data points.
      expect(timeOrder(result.spec_user_trend)).toEqual(
        expected.slice(expected.length - timestamps.length)
      )
    }
  )
})
