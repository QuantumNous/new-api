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
import { appendPercentSign, formatFixed } from '@/lib/format'

describe('appendPercentSign', () => {
  it('in English, appends % with no space, as before', () => {
    const locale = toIntlLocale('en')
    expect(appendPercentSign(formatFixed(4.4, 1, locale), locale)).toBe('4.4%')
  })

  it('in Persian, appends the Persian percent sign', () => {
    const locale = toIntlLocale('fa')
    expect(appendPercentSign(formatFixed(4.4, 1, locale), locale)).toBe('۴٫۴٪')
  })

  it.each(['zhCN', 'zhTW', 'fr', 'ru', 'ja', 'vi'])(
    'for %s, appends % with no space',
    (language) => {
      expect(appendPercentSign('45', toIntlLocale(language))).toBe('45%')
    }
  )

  it('for an unknown interface language, appends %', () => {
    expect(appendPercentSign('45', toIntlLocale('xx-invalid'))).toBe('45%')
  })
})
