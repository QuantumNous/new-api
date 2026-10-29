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

import { toIntlLocale } from '@/i18n/languages'
import { formatFixed } from '@/lib/format'

describe('formatFixed', () => {
  it.each([
    [1.2, 2, '1.20'],
    [1.005, 2, '1.00'],
    [12345.678, 2, '12345.68'],
    [42.25, 1, '42.3'],
    [0, 1, '0.0'],
  ])(
    'in English, writes %d with %d digits exactly as toFixed does',
    (value, digits, expected) => {
      expect(formatFixed(value, digits, toIntlLocale('en'))).toBe(expected)
      expect(formatFixed(value, digits, toIntlLocale('en'))).toBe(
        value.toFixed(digits)
      )
    }
  )

  it('in Persian, writes Persian digits and the Persian decimal separator', () => {
    expect(formatFixed(1.2, 2, toIntlLocale('fa'))).toBe('۱٫۲۰')
  })

  it.each(['fr', 'ru', 'vi'])('for %s, writes a decimal comma', (language) => {
    expect(formatFixed(12345.678, 2, toIntlLocale(language))).toBe('12345,68')
  })

  it.each(['zhCN', 'zhTW', 'ja'])(
    'for %s, keeps the decimal point and Latin digits',
    (language) => {
      expect(formatFixed(12345.678, 2, toIntlLocale(language))).toBe('12345.68')
    }
  )

  it('for an unknown interface language, falls back to the runtime default locale', () => {
    // Pin the runtime default so the fallback does not depend on the machine.
    const NumberFormat = Intl.NumberFormat
    vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (
      locales?: Intl.LocalesArgument,
      options?: Intl.NumberFormatOptions
    ) {
      // en-US stands in for the runtime default when no requested
      // locale is supported.
      const supported = NumberFormat.supportedLocalesOf(locales ?? [])
      return new NumberFormat(
        supported.length > 0 ? supported : 'en-US',
        options
      )
    } as typeof Intl.NumberFormat)

    expect(formatFixed(1.2, 2, toIntlLocale('xx-invalid'))).toBe('1.20')
  })
})
