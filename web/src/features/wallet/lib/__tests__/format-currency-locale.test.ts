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

import { INTERFACE_LANGUAGE_OPTIONS, toIntlLocale } from '@/i18n/languages'

import { formatCurrency } from '../format'

const PERSIAN_DIGIT = /[۰-۹]/

describe('formatCurrency locale', () => {
  it.each(
    INTERFACE_LANGUAGE_OPTIONS.filter(
      (option) => (option.code as string) !== 'fa'
    ).map((option) => option.code)
  )('renders Latin digits for the %s interface language', (code) => {
    const formatted = formatCurrency(12.5, toIntlLocale(code))

    expect(formatted).toMatch(/12.5/)
    expect(formatted).not.toMatch(PERSIAN_DIGIT)
  })

  it('renders Persian digits for the fa interface language', () => {
    expect(formatCurrency(12.5, toIntlLocale('fa'))).toBe('۱۲٫۵')
  })

  it('falls back to the runtime locale for an invalid language code', () => {
    expect(formatCurrency(12.5, toIntlLocale('not a language'))).toBe(
      formatCurrency(12.5)
    )
  })
})
