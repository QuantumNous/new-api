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

import { formatChartTime, formatDate, formatDateTimeObject } from './time'

describe('localized time formatting', () => {
  const date = new Date(2026, 6, 22, 13, 5, 9)
  const timestamp = Math.floor(date.getTime() / 1000)

  it('uses Vietnamese date ordering when vi-VN is requested', () => {
    expect(formatDate(timestamp, 'vi-VN')).toBe('22 thg 7, 2026')
    expect(formatDateTimeObject(date, 'vi-VN')).toContain('22 thg 7, 2026')
  })

  it('keeps chart labels compact while respecting Vietnamese ordering', () => {
    expect(formatChartTime(timestamp, 'day', 'vi-VN')).toBe('22-07')
    // The offset label follows the machine timezone, so only its shape is stable.
    expect(formatChartTime(timestamp, 'hour', 'vi-VN')).toMatch(
      /^22-07 13:05 GMT([+-]\d{1,2}(:\d{2})?)?$/
    )
  })
})
