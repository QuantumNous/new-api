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

import { toIntlLocale } from '@/i18n/languages'

import { formatDuration, formatResetPeriod } from '../format'

const t = ((key: string) => key) as Parameters<typeof formatDuration>[1]

describe('subscription duration and reset period', () => {
  it('in English, keeps the numbers without grouping', () => {
    const en = toIntlLocale('en')
    expect(
      formatDuration({ duration_unit: 'day', duration_value: 1000 }, t, en)
    ).toBe('1000 days')
    expect(
      formatResetPeriod(
        { quota_reset_period: 'custom', quota_reset_custom_seconds: 59 },
        t,
        en
      )
    ).toBe('59 seconds')
  })

  it('in Persian, writes the numbers with Persian digits', () => {
    const fa = toIntlLocale('fa')
    expect(
      formatDuration({ duration_unit: 'month', duration_value: 12 }, t, fa)
    ).toBe('۱۲ months')
    expect(
      formatDuration({ duration_unit: 'custom', custom_seconds: 7200 }, t, fa)
    ).toBe('۲ hours')
    expect(
      formatResetPeriod(
        { quota_reset_period: 'custom', quota_reset_custom_seconds: 172800 },
        t,
        fa
      )
    ).toBe('۲ days')
  })
})
