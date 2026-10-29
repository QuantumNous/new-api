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
import { afterEach, describe, expect, it } from 'vitest'

import { INTERFACE_LANGUAGE_OPTIONS, toIntlLocale } from '@/i18n/languages'
import { formatLogQuota, formatQuota } from '@/lib/format'
import { useSystemConfigStore } from '@/stores/system-config-store'

// Default currency config: 500000 quota units = 1 USD.
const TWELVE_DOLLARS = 6_000_000
const PERSIAN_DIGIT = /[۰-۹]/
const LATIN_TWELVE = /12/

afterEach(() => {
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
})

describe('formatQuota locale', () => {
  it.each(
    INTERFACE_LANGUAGE_OPTIONS.filter(
      (option) => (option.code as string) !== 'fa'
    ).map((option) => option.code)
  )('renders Latin digits for the %s interface language', (code) => {
    const formatted = formatQuota(TWELVE_DOLLARS, toIntlLocale(code))

    expect(formatted).toMatch(LATIN_TWELVE)
    expect(formatted).not.toMatch(PERSIAN_DIGIT)
  })

  it('renders Persian digits for the fa interface language', () => {
    const formatted = formatQuota(TWELVE_DOLLARS, toIntlLocale('fa'))

    expect(formatted).toMatch(/۱۲/)
    expect(formatted).not.toMatch(LATIN_TWELVE)
  })

  it('falls back to the runtime locale for an invalid language code', () => {
    expect(toIntlLocale('not a language')).toBeUndefined()
    expect(formatQuota(TWELVE_DOLLARS, toIntlLocale('not a language'))).toBe(
      formatQuota(TWELVE_DOLLARS)
    )
  })
})

describe('formatLogQuota locale', () => {
  it.each(
    INTERFACE_LANGUAGE_OPTIONS.filter(
      (option) => (option.code as string) !== 'fa'
    ).map((option) => option.code)
  )('renders Latin digits for the %s interface language', (code) => {
    const formatted = formatLogQuota(TWELVE_DOLLARS, toIntlLocale(code))

    expect(formatted).toMatch(LATIN_TWELVE)
    expect(formatted).not.toMatch(PERSIAN_DIGIT)
  })

  it('renders Persian digits for the fa interface language', () => {
    const formatted = formatLogQuota(TWELVE_DOLLARS, toIntlLocale('fa'))

    expect(formatted).toMatch(/۱۲/)
    expect(formatted).not.toMatch(LATIN_TWELVE)
  })

  it('falls back to the runtime locale for an invalid language code', () => {
    expect(formatLogQuota(TWELVE_DOLLARS, toIntlLocale('not a language'))).toBe(
      formatLogQuota(TWELVE_DOLLARS)
    )
  })
})
