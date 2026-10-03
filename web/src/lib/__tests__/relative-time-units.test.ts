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

  const halfway = [
    {
      label: '59.5 s',
      offset: 59 * SECOND + 500,
      ago: '1 minute ago',
      agoRu: '1 минуту назад',
      ahead: 'in 1 minute',
    },
    {
      label: '59 min 30 s',
      offset: 59 * MINUTE + 30 * SECOND,
      ago: '1 hour ago',
      agoRu: '1 час назад',
      ahead: 'in 1 hour',
    },
    {
      label: '23 h 30 min',
      offset: 23 * HOUR + 30 * MINUTE,
      ago: '1 day ago',
      agoRu: '1 день назад',
      ahead: 'in 1 day',
    },
    {
      label: '29 d 12 h',
      offset: 29 * DAY + 12 * HOUR,
      ago: '1 month ago',
      agoRu: '1 месяц назад',
      ahead: 'in 1 month',
    },
    {
      label: '345 d',
      offset: 345 * DAY,
      ago: '1 year ago',
      agoRu: '1 год назад',
      ahead: 'in 1 year',
    },
  ]

  it.each(halfway)(
    'rounds exactly halfway $label ago up like the future: $ago',
    ({ offset, ago, agoRu }) => {
      expect(relative(-offset, 'en')).toBe(ago)
      expect(relative(-offset, 'ru')).toBe(agoRu)
    }
  )

  it.each(halfway)(
    'rounds exactly halfway $label ahead up: $ahead',
    ({ offset, ahead }) => {
      expect(relative(offset, 'en')).toBe(ahead)
    }
  )

  it('keeps 0 seconds ago for a moment just past', () => {
    expect(relative(-499, 'en')).toBe('0 seconds ago')
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
