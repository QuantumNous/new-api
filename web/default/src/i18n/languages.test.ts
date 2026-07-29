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

import { normalizeInterfaceLanguage, toIntlLocale } from './languages'

describe('toIntlLocale', () => {
  it('maps project language codes to BCP-47 tags', () => {
    expect(toIntlLocale('zhCN')).toBe('zh-CN')
    expect(toIntlLocale('zhTW')).toBe('zh-TW')
    expect(toIntlLocale('vi')).toBe('vi-VN')
    expect(toIntlLocale('en')).toBe('en')
  })

  it('accepts compact/accidental variants without throwing', () => {
    expect(toIntlLocale('zhcn')).toBe('zh-CN')
    expect(toIntlLocale('zh-CN')).toBe('zh-CN')
    expect(() => new Intl.DateTimeFormat(toIntlLocale('zhCN'))).not.toThrow()
  })

  it('normalizes interface languages', () => {
    expect(normalizeInterfaceLanguage('vi-VN')).toBe('vi')
    expect(normalizeInterfaceLanguage('vi_VN')).toBe('vi')
  })
})
