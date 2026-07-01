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
import en from '@/i18n/locales/en.json'
import es from '@/i18n/locales/es.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import pt from '@/i18n/locales/pt.json'
import ru from '@/i18n/locales/ru.json'
import vi from '@/i18n/locales/vi.json'
import zh from '@/i18n/locales/zh.json'
import { describe, expect, test } from 'bun:test'

const deprecatedStripePromotionConfigKeys = [
  'Allow users to enter promo codes',
  'Promotion codes',
  'Promotion codes always enabled',
  'Stripe Checkout always shows the coupon code field. This legacy switch is kept for compatibility.',
]

const locales = { en, es, fr, ja, pt, ru, vi, zh }

describe('Stripe promotion code settings copy', () => {
  test('does not expose deprecated promotion-code configuration labels', () => {
    for (const [locale, messages] of Object.entries(locales)) {
      for (const key of deprecatedStripePromotionConfigKeys) {
        expect(
          messages.translation,
          `${locale} still contains ${key}`
        ).not.toHaveProperty(key)
      }
    }
  })
})
