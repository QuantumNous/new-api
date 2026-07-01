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
import en from '../../../i18n/locales/en.json'
import es from '../../../i18n/locales/es.json'
import fr from '../../../i18n/locales/fr.json'
import ja from '../../../i18n/locales/ja.json'
import pt from '../../../i18n/locales/pt.json'
import ru from '../../../i18n/locales/ru.json'
import vi from '../../../i18n/locales/vi.json'
import zh from '../../../i18n/locales/zh.json'

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

const walletRechargeKeys = [
  'Top-up Packages',
  'Choose a prepaid USD package and checkout with Stripe',
  'Top up {{price}}',
  'Lowest entry to get started',
  'Prepaid balance, no surprise bill',
  'No contract required. Add balance, create a key, copy the base_url, and test your first request.',
  '3X more usage than the official plan',
  'Best first top-up for trying real API workloads with a clear discount.',
  'Most Popular',
  'Permanently 20-40% cheaper',
  'Usage analytics and cost controls',
  'Enterprise-grade privacy',
  'One invoice across providers',
  '40X more usage than the official plan',
  'Best value for production testing, team workflows, and sustained model traffic.',
  'Highest prepaid value',
  'Custom',
  'Enterprise',
  'Custom usage, routing, and invoicing',
  'For higher monthly usage, invoicing, team procurement, or custom routing discounts.',
  'Custom monthly usage',
  'Team procurement support',
  'Custom routing discounts',
  'Contact Us',
  'Get {{bonus}} free',
  'Top up for {{amount}}',
  'No top-up packages available. Please contact administrator.',
  'Stripe top-up is not enabled. Please contact administrator.',
] as const

describe('wallet recharge i18n', () => {
  test('defines wallet recharge package keys in every interface locale', () => {
    for (const [locale, translations] of Object.entries(localeTranslations)) {
      for (const key of walletRechargeKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(translations, key),
          `${locale} is missing ${key}`
        ).toBe(true)
      }
    }
  })

  test('translates new wallet recharge keys outside English', () => {
    const newWalletKeys = [
      'Top-up Packages',
      'Choose a prepaid USD package and checkout with Stripe',
      'Custom usage, routing, and invoicing',
      'For higher monthly usage, invoicing, team procurement, or custom routing discounts.',
    ] as const

    for (const [locale, translations] of Object.entries(localeTranslations)) {
      if (locale === 'en') {
        continue
      }

      for (const key of newWalletKeys) {
        expect(
          translations[key],
          `${locale} should translate ${key}`
        ).not.toBe(key)
      }
    }
  })
})
