/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'bun:test'
import {
  resolveSubscriptionPlanDisplayPrice,
  resolveSubscriptionPlanGridCurrency,
} from './subscription-plan-prices'

const plans = [
  {
    price_amount: 10,
    currency: 'USD',
    currency_prices: { USD: 10, JPY: 1_500, BRL: 49.9 },
  },
  {
    price_amount: 30,
    currency: 'USD',
    currency_prices: { USD: 30, JPY: 4_500, BRL: 149.9 },
  },
  {
    price_amount: 100,
    currency: 'USD',
    currency_prices: { USD: 100, JPY: 15_000, BRL: 499.9 },
  },
]

describe('resolveSubscriptionPlanGridCurrency', () => {
  test('selects JPY for Japanese and BRL for Portuguese when every plan is configured', () => {
    expect(resolveSubscriptionPlanGridCurrency(plans, 'ja-JP')).toBe('JPY')
    expect(resolveSubscriptionPlanGridCurrency(plans, 'pt-BR')).toBe('BRL')
  })

  test('uses USD for every other language', () => {
    expect(resolveSubscriptionPlanGridCurrency(plans, 'zh-CN')).toBe('USD')
    expect(resolveSubscriptionPlanGridCurrency(plans, 'en')).toBe('USD')
  })

  test('falls the whole grid back to USD when one plan is missing the language currency', () => {
    const incompletePlans = plans.map((plan, index) =>
      index === 2
        ? { ...plan, currency_prices: { USD: plan.price_amount } }
        : plan
    )

    expect(resolveSubscriptionPlanGridCurrency(incompletePlans, 'ja-JP')).toBe(
      'USD'
    )
  })
})

describe('resolveSubscriptionPlanDisplayPrice', () => {
  test('returns the configured major-unit amount for the selected grid currency', () => {
    expect(resolveSubscriptionPlanDisplayPrice(plans[0], 'JPY')).toEqual({
      amount: 1_500,
      currency: 'JPY',
    })
    expect(resolveSubscriptionPlanDisplayPrice(plans[0], 'BRL')).toEqual({
      amount: 49.9,
      currency: 'BRL',
    })
  })

  test('falls back to the canonical plan price when USD is unexpectedly absent', () => {
    expect(
      resolveSubscriptionPlanDisplayPrice(
        { price_amount: 12, currency: 'EUR', currency_prices: {} },
        'USD'
      )
    ).toEqual({ amount: 12, currency: 'EUR' })
  })
})
