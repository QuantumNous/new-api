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

import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import ru from '@/i18n/locales/ru.json'
import vi from '@/i18n/locales/vi.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'

const LOCALES = {
  en,
  fr,
  ja,
  ru,
  vi,
  zh,
  'zh-TW': zhTW,
} as const

const CREATED_DIALOG_KEYS = [
  'Copied {{count}} code(s)',
  'Copy redemption code {{index}}',
  'Copy the codes below now, or find them anytime in the redemption code list.',
] as const

describe('created dialog production translations', () => {
  test('every locale ships all three created-dialog keys', () => {
    for (const [locale, resources] of Object.entries(LOCALES)) {
      const translation = resources.translation as Record<string, string>
      for (const key of CREATED_DIALOG_KEYS) {
        expect(translation[key], `${locale} missing ${key}`).toEqual(
          expect.any(String)
        )
        expect(translation[key]?.trim().length ?? 0).toBeGreaterThan(0)
      }
    }
  })

  test('Chinese locales do not fall back to the English source string', () => {
    const source = en.translation as Record<string, string>
    for (const locale of ['zh', 'zh-TW'] as const) {
      const translation = LOCALES[locale].translation as Record<string, string>
      for (const key of CREATED_DIALOG_KEYS) {
        expect(translation[key]).not.toBe(source[key])
      }
    }
  })
})
