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

import { toIntlLocale } from '@/i18n/languages'
import type { TimeGranularity } from '@/lib/time'

import type { QuotaDataItem } from '../../types'
import { processChartData, processUserChartData } from '../charts'

type ChartSpec = { data: Array<{ values: Array<{ Time: string }> }> }

const fa = toIntlLocale('fa')
const en = toIntlLocale('en')

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

// 2026-03-20 is 1404/12/29, the last day of the Solar Hijri year;
// 2026-03-21 is 1405/01/01 (Nowruz).
const nowruzDays = [
  at(2026, 3, 20),
  at(2026, 3, 21),
  at(2026, 3, 22),
  at(2026, 3, 23),
]

const faCases: Array<{
  granularity: TimeGranularity
  timestamps: number[]
  expected: string[]
}> = [
  {
    granularity: 'day',
    timestamps: nowruzDays,
    expected: ['۱۲/۲۶', '۱۲/۲۷', '۱۲/۲۸', '۱۲/۲۹', '۰۱/۰۱', '۰۱/۰۲', '۰۱/۰۳'],
  },
  {
    granularity: 'hour',
    timestamps: [
      at(2026, 3, 20, 21),
      at(2026, 3, 20, 22),
      at(2026, 3, 20, 23),
      at(2026, 3, 21, 0),
      at(2026, 3, 21, 1),
      at(2026, 3, 21, 2),
      at(2026, 3, 21, 3),
    ],
    expected: [
      '۱۲/۲۹ ۲۱:۰۰',
      '۱۲/۲۹ ۲۲:۰۰',
      '۱۲/۲۹ ۲۳:۰۰',
      '۰۱/۰۱ ۰۰:۰۰',
      '۰۱/۰۱ ۰۱:۰۰',
      '۰۱/۰۱ ۰۲:۰۰',
      '۰۱/۰۱ ۰۳:۰۰',
    ],
  },
  {
    granularity: 'week',
    timestamps: [
      at(2026, 2, 9),
      at(2026, 2, 16),
      at(2026, 2, 23),
      at(2026, 3, 2),
      at(2026, 3, 9),
      at(2026, 3, 16),
      at(2026, 3, 23),
    ],
    expected: [
      '۱۱/۲۰ - ۱۱/۲۶',
      '۱۱/۲۷ - ۱۲/۰۳',
      '۱۲/۰۴ - ۱۲/۱۰',
      '۱۲/۱۱ - ۱۲/۱۷',
      '۱۲/۱۸ - ۱۲/۲۴',
      '۱۲/۲۵ - ۰۱/۰۲',
      '۰۱/۰۳ - ۰۱/۰۹',
    ],
  },
]

describe('dashboard chart labels in the interface locale', () => {
  test.each(faCases)(
    'fa model charts with $granularity granularity show Solar Hijri labels in order across Nowruz',
    ({ granularity, timestamps, expected }) => {
      const result = processChartData(
        rows(timestamps),
        granularity,
        undefined,
        undefined,
        fa
      )

      expect(timeOrder(result.spec_line)).toEqual(expected)
      expect(timeOrder(result.spec_area)).toEqual(expected)
      expect(timeOrder(result.spec_model_line)).toEqual(expected)
    }
  )

  test('fa user trend shows Solar Hijri labels in order across Nowruz', () => {
    const result = processUserChartData(
      rows(nowruzDays),
      'day',
      undefined,
      10,
      fa
    )

    expect(timeOrder(result.spec_user_trend)).toEqual([
      '۱۲/۲۹',
      '۰۱/۰۱',
      '۰۱/۰۲',
      '۰۱/۰۳',
    ])
  })

  test('en labels stay Gregorian and equal the labels without a locale', () => {
    const withEn = processChartData(
      rows(nowruzDays),
      'day',
      undefined,
      undefined,
      en
    )
    const withoutLocale = processChartData(rows(nowruzDays), 'day')

    expect(timeOrder(withEn.spec_line)).toEqual([
      '03-17',
      '03-18',
      '03-19',
      '03-20',
      '03-21',
      '03-22',
      '03-23',
    ])
    expect((withEn.spec_line as ChartSpec).data).toEqual(
      (withoutLocale.spec_line as ChartSpec).data
    )
    expect(
      timeOrder(
        processUserChartData(rows(nowruzDays), 'day', undefined, 10, en)
          .spec_user_trend
      )
    ).toEqual(['03-20', '03-21', '03-22', '03-23'])
  })
})
