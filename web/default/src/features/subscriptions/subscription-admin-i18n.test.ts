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

const lifecycleAdminKeys = [
  'Tier Rank',
  'Payment Modes',
  'Stripe recurring',
  'Balance one period',
  'External one period',
  'Tier rank must be a positive integer',
  'Stripe recurring payment mode requires Stripe Price ID.',
  'Stripe Price ID requires Stripe recurring payment mode.',
  'Pix monthly price (BRL)',
  'UPI monthly price (INR)',
  'Local price must be greater than zero',
  'Local price cannot exceed 9999.999999',
  'This plan already has lifecycle references. Disable it or create a new version instead of changing lifecycle-critical fields.',
  'Current Entitlement',
  'Read-only History',
  'Binding State',
  'Pending Intent',
  'Grace Period',
  'Migration Conflict',
  'No current entitlement',
  'No pending intent',
] as const

describe('subscription admin lifecycle i18n', () => {
  test('defines admin lifecycle keys in every interface locale', () => {
    for (const [locale, translations] of Object.entries(localeTranslations)) {
      for (const key of lifecycleAdminKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(translations, key),
          `${locale} is missing ${key}`
        ).toBe(true)
      }
    }
  })

  test('translates lifecycle admin copy outside English', () => {
    const newCopyKeys = [
      'Tier Rank',
      'Payment Modes',
      'Stripe recurring payment mode requires Stripe Price ID.',
      'Current Entitlement',
      'Migration Conflict',
    ] as const

    for (const [locale, translations] of Object.entries(localeTranslations)) {
      if (locale === 'en') {
        continue
      }

      for (const key of newCopyKeys) {
        expect(translations[key], `${locale} should translate ${key}`).not.toBe(
          key
        )
      }
    }
  })
})
