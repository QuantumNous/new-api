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
import { afterEach, describe, expect, it, vi } from 'vitest'

import { INTERFACE_LANGUAGE_OPTIONS, toIntlLocale } from '@/i18n/languages'
import {
  formatDateStr,
  formatDateTimeStr,
  formatGregorianTitle,
  formatTimestamp,
  formatTimestampForInput,
  formatTimestampRelative,
  formatTimestampToDate,
  formatTimeStr,
} from '@/lib/format'
import { formatChartTime, formatDate, formatDateTimeObject } from '@/lib/time'

// 2026-09-25 15:05:09 local time is 3 Mehr 1405 in the Solar Hijri calendar.
const LOCAL_DATE = new Date(2026, 8, 25, 15, 5, 9)
const TS = Math.floor(LOCAL_DATE.getTime() / 1000)
const FA = toIntlLocale('fa')
const NON_PERSIAN_CODES = INTERFACE_LANGUAGE_OPTIONS.filter(
  (option) => (option.code as string) !== 'fa'
).map((option) => option.code)

afterEach(() => {
  vi.useRealTimers()
})

describe('display dates for languages other than Persian', () => {
  it.each(NON_PERSIAN_CODES)(
    'with the %s interface language, keeps the Gregorian output unchanged',
    (code) => {
      const locale = toIntlLocale(code)

      expect(formatTimestampToDate(TS, 'seconds', locale)).toBe(
        '2026-09-25 15:05:09'
      )
      expect(formatTimestamp(TS, locale)).toBe('2026-09-25 15:05:09')
      expect(formatDateTimeStr(LOCAL_DATE, locale)).toBe('2026-09-25 15:05:09')
      expect(formatDateStr(LOCAL_DATE, locale)).toBe('2026-09-25')
      expect(formatTimeStr(LOCAL_DATE, locale)).toBe('15:05:09')
      expect(formatDate(TS, locale)).toBe('2026-09-25')
      expect(formatDateTimeObject(LOCAL_DATE, locale)).toBe(
        '2026-09-25 15:05:09'
      )
      expect(formatChartTime(TS, 'day', locale)).toBe('09-25')
      expect(formatChartTime(TS, 'hour', locale)).toBe('09-25 15:00')
      expect(formatChartTime(TS, 'week', locale)).toBe('09-25 - 10-01')
    }
  )

  it.each(NON_PERSIAN_CODES)(
    'with the %s interface language, adds no Gregorian title',
    (code) => {
      expect(formatGregorianTitle(TS, toIntlLocale(code))).toBeUndefined()
    }
  )

  it('without a locale or with an invalid one, keeps the Gregorian output', () => {
    expect(formatTimestampToDate(TS)).toBe('2026-09-25 15:05:09')
    expect(
      formatTimestampToDate(TS, 'seconds', toIntlLocale('not a language'))
    ).toBe('2026-09-25 15:05:09')
  })
})

describe('display dates in Persian', () => {
  it('formats date and time in the Solar Hijri calendar with Persian digits', () => {
    expect(formatTimestampToDate(TS, 'seconds', FA)).toBe('۱۴۰۵/۰۷/۰۳ ۱۵:۰۵:۰۹')
    expect(formatTimestampToDate(TS * 1000, 'milliseconds', FA)).toBe(
      '۱۴۰۵/۰۷/۰۳ ۱۵:۰۵:۰۹'
    )
    expect(formatTimestamp(TS, FA)).toBe('۱۴۰۵/۰۷/۰۳ ۱۵:۰۵:۰۹')
    expect(formatDateTimeStr(LOCAL_DATE, FA)).toBe('۱۴۰۵/۰۷/۰۳ ۱۵:۰۵:۰۹')
    expect(formatDateTimeObject(LOCAL_DATE, FA)).toBe('۱۴۰۵/۰۷/۰۳ ۱۵:۰۵:۰۹')
  })

  it('formats date-only, time-only and chart labels in the Solar Hijri calendar', () => {
    expect(formatDateStr(LOCAL_DATE, FA)).toBe('۱۴۰۵/۰۷/۰۳')
    expect(formatDate(TS, FA)).toBe('۱۴۰۵/۰۷/۰۳')
    expect(formatTimeStr(LOCAL_DATE, FA)).toBe('۱۵:۰۵:۰۹')
    expect(formatChartTime(TS, 'day', FA)).toBe('۰۷/۰۳')
    expect(formatChartTime(TS, 'hour', FA)).toBe('۰۷/۰۳ ۱۵:۰۰')
    expect(formatChartTime(TS, 'week', FA)).toBe('۰۷/۰۳ - ۰۷/۰۹')
  })

  it('with the Latin-digit Persian locale tag, keeps Solar Hijri with Latin digits', () => {
    expect(formatTimestampToDate(TS, 'seconds', 'fa-u-nu-latn')).toBe(
      '1405/07/03 15:05:09'
    )
  })

  it('offers the Gregorian date and time as a title, and none for missing timestamps', () => {
    expect(formatGregorianTitle(TS, FA)).toBe('2026-09-25 15:05:09')
    expect(formatGregorianTitle(TS * 1000, FA, 'milliseconds')).toBe(
      '2026-09-25 15:05:09'
    )
    expect(formatGregorianTitle(0, FA)).toBeUndefined()
    expect(formatGregorianTitle(-1, FA)).toBeUndefined()
  })

  it('keeps missing timestamps as a dash', () => {
    expect(formatTimestampToDate(0, 'seconds', FA)).toBe('-')
    expect(formatTimestampToDate(-1, 'seconds', FA)).toBe('-')
  })

  it('keeps input values Gregorian', () => {
    expect(formatTimestampForInput(TS)).toBe('2026-09-25T15:05')
  })

  it('formats relative time in Persian', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date((TS + 180) * 1000))

    expect(formatTimestampRelative(TS, 'seconds', FA)).toBe('۳ دقیقه پیش')
  })
})
