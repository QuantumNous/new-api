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

import type { QuotaDataItem } from '../../types'
import { processChartData, processUserChartData } from '../charts'

// Default currency config: 500000 quota units = 1 USD, so 11490000 is $22.98.
const rows: QuotaDataItem[] = [
  {
    created_at: 1_790_000_000,
    model_name: 'gpt-4.1',
    username: 'alice',
    quota: 11_490_000,
    count: 1234,
    token_used: 10,
  },
]

describe('dashboard chart totals', () => {
  it('in English, keeps the header totals as before', () => {
    const result = processChartData(
      rows,
      'day',
      undefined,
      undefined,
      toIntlLocale('en')
    )
    expect(result.totalQuotaDisplay).toBe('$22.98')
    expect(result.totalCountDisplay).toBe('1,234')
  })

  it('in Persian, writes the header totals with Persian digits', () => {
    const result = processChartData(
      rows,
      'day',
      undefined,
      undefined,
      toIntlLocale('fa')
    )
    expect(result.totalQuotaDisplay).toBe('$۲۲٫۹۸')
    expect(result.totalCountDisplay).toBe('۱٬۲۳۴')
  })

  it('in French, writes the quota total with a decimal comma', () => {
    const result = processChartData(
      rows,
      'day',
      undefined,
      undefined,
      toIntlLocale('fr')
    )
    expect(result.totalQuotaDisplay).toBe('$22,98')
  })

  it('in Persian, writes the smallest non-zero quota with Persian digits', () => {
    const tiny = [{ ...rows[0], quota: 1 }]
    const result = processChartData(
      tiny,
      'day',
      undefined,
      undefined,
      toIntlLocale('fa')
    )
    expect(result.totalQuotaDisplay).toBe('$۰٫۰۱')
  })

  it('in Persian, writes the user ranking values with Persian digits', () => {
    const result = processUserChartData(
      rows,
      'day',
      undefined,
      10,
      toIntlLocale('fa')
    )
    expect(JSON.stringify(result)).toContain('$۲۲٫۹۸')
  })
})
