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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatTimestampRelative } from '../format'

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function relative(offset: number, locale: string) {
  return formatTimestampRelative(NOW + offset, 'milliseconds', locale)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('formatTimestampRelative unit choice', () => {
  it.each([
    {
      label: '59 min 31 s',
      ago: 59 * MINUTE + 31 * SECOND,
      en: '1 hour ago',
      ru: '1 час назад',
    },
    {
      label: '23 h 31 min',
      ago: 23 * HOUR + 31 * MINUTE,
      en: '1 day ago',
      ru: '1 день назад',
    },
    {
      label: '29 d 13 h',
      ago: 29 * DAY + 13 * HOUR,
      en: '1 month ago',
      ru: '1 месяц назад',
    },
    {
      label: '345 d 1 h',
      ago: 345 * DAY + HOUR,
      en: '1 year ago',
      ru: '1 год назад',
    },
    { label: '364 d', ago: 364 * DAY, en: '1 year ago', ru: '1 год назад' },
  ])('$label ago rounds up to the next unit: $en', ({ ago, en, ru }) => {
    expect(relative(-ago, 'en')).toBe(en)
    expect(relative(-ago, 'ru')).toBe(ru)
  })

  it('rounds a future time up to the next unit as well: in 1 hour', () => {
    expect(relative(59 * MINUTE + 30 * SECOND, 'en')).toBe('in 1 hour')
  })

  it.each([
    { ago: 59 * MINUTE + 29 * SECOND, en: '59 minutes ago' },
    { ago: 23 * HOUR + 29 * MINUTE, en: '23 hours ago' },
    { ago: 29 * DAY + 11 * HOUR, en: '29 days ago' },
    { ago: 344 * DAY, en: '11 months ago' },
  ])('keeps $en just below the next unit', ({ ago, en }) => {
    expect(relative(-ago, 'en')).toBe(en)
  })
})
