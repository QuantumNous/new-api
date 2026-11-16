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
import { describe, expect, test } from 'vitest'
import { INTERFACE_LANGUAGE_OPTIONS, convertDetectedLanguage, normalizeInterfaceLanguage, toIntlLocale } from './languages'

describe('Orbit English-only language policy', () => {
  test('exposes English as the only interface choice', () => {
    expect(INTERFACE_LANGUAGE_OPTIONS).toEqual([{ code: 'en', label: 'English' }])
  })
  test.each(['en', 'en-US', 'zhCN', 'zh-TW', 'fr-FR', 'ja', 'invalid'])('normalizes legacy preference %s to English', (language) => {
    expect(normalizeInterfaceLanguage(language)).toBe('en')
    expect(convertDetectedLanguage(language)).toBe('en')
    expect(toIntlLocale(language)).toBe('en')
  })
})
