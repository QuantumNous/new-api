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
import { act } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'

import { formatDateStr, formatTimestampToDate } from '@/lib/format'

const NOVEMBER_7_2026_13_45 = Math.floor(
  new Date(2026, 10, 7, 13, 45, 0).getTime() / 1000
)

afterEach(async () => {
  await act(() => i18next.changeLanguage('en'))
})

describe('payment log date rendering', () => {
  it('renders the created-at column with Gregorian tokens', () => {
    expect(formatTimestampToDate(NOVEMBER_7_2026_13_45)).toBe(
      '2026-11-07 13:45:00'
    )
  })

  it('stays Gregorian under an Arabic interface', async () => {
    if (!i18next.hasResourceBundle('ar', 'translation')) {
      i18next.addResourceBundle('ar', 'translation', {})
    }
    await act(() => i18next.changeLanguage('ar'))

    expect(formatTimestampToDate(NOVEMBER_7_2026_13_45)).toBe(
      '2026-11-07 13:45:00'
    )
    expect(formatDateStr(new Date(2026, 10, 7))).toBe('2026-11-07')
  })

  it('keeps empty timestamps as a dash', () => {
    expect(formatTimestampToDate(0)).toBe('-')
    expect(formatTimestampToDate(-1)).toBe('-')
  })
})
