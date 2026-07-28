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
import { describe, expect, test } from 'bun:test'
import en from '../../i18n/locales/en.json'
import es from '../../i18n/locales/es.json'
import fr from '../../i18n/locales/fr.json'
import ja from '../../i18n/locales/ja.json'
import pt from '../../i18n/locales/pt.json'
import ru from '../../i18n/locales/ru.json'
import vi from '../../i18n/locales/vi.json'
import zh from '../../i18n/locales/zh.json'
import { STATIC_I18N_KEYS } from '../../i18n/static-keys'

const localeTranslations = {
  en: en.translation,
  es: es.translation,
  fr: fr.translation,
  ja: ja.translation,
  pt: pt.translation,
  ru: ru.translation,
  vi: vi.translation,
  zh: zh.translation,
} as const

const profileBalanceGuidanceKeys = [
  'Balance can be used to purchase plans directly.',
  'After plan quota is exhausted, balance is used automatically for API usage billing.',
] as const

describe('profile i18n', () => {
  test('defines profile balance guidance in every interface locale', () => {
    for (const [locale, translations] of Object.entries(localeTranslations)) {
      for (const key of profileBalanceGuidanceKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(translations, key),
          `${locale} is missing ${key}`
        ).toBe(true)
        expect(translations[key], `${locale} should define ${key}`).not.toBe('')
        expect(
          translations[key],
          `${locale} contains replacement question marks for ${key}`
        ).not.toContain('?')
      }
    }
  })

  test('translates profile balance guidance outside English', () => {
    for (const [locale, translations] of Object.entries(localeTranslations)) {
      if (locale === 'en') {
        continue
      }

      for (const key of profileBalanceGuidanceKeys) {
        expect(translations[key], `${locale} should translate ${key}`).not.toBe(
          key
        )
      }
    }
  })

  test('registers profile balance guidance as static i18n keys', () => {
    for (const key of profileBalanceGuidanceKeys) {
      expect(STATIC_I18N_KEYS).toContain(key)
    }
  })
})
