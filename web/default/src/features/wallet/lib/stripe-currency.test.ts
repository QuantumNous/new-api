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
import {
  currencySupportsPresetAmounts,
  defaultCurrencyForLanguage,
  normalizeStripeCheckoutCurrency,
  parseStripeCurrencyPrices,
  stripeTopUpDisplayAmount,
} from './stripe-currency'

describe('normalizeStripeCheckoutCurrency', () => {
  test('normalizes explicit checkout currency search params', () => {
    expect(normalizeStripeCheckoutCurrency('usd')).toBe('USD')
    expect(normalizeStripeCheckoutCurrency(' JPY ')).toBe('JPY')
    expect(normalizeStripeCheckoutCurrency('brl')).toBe('BRL')
    expect(normalizeStripeCheckoutCurrency('eur')).toBeUndefined()
    expect(normalizeStripeCheckoutCurrency(undefined)).toBeUndefined()
  })
})

describe('defaultCurrencyForLanguage', () => {
  test('maps the active interface language and defaults to USD', () => {
    expect(defaultCurrencyForLanguage('pt')).toBe('BRL')
    expect(defaultCurrencyForLanguage('pt-BR')).toBe('BRL')
    expect(defaultCurrencyForLanguage('ja-JP')).toBe('JPY')
    expect(defaultCurrencyForLanguage('zh-CN')).toBe('USD')
    expect(defaultCurrencyForLanguage(undefined)).toBe('USD')
  })
})

describe('parseStripeCurrencyPrices', () => {
  test('parses positive minor-unit prices and formats major units', () => {
    const prices = parseStripeCurrencyPrices({
      USD: { 20: 2000 },
      JPY: { 20: 3000 },
      EUR: { 20: 1800 },
    })

    expect(prices).toEqual({ USD: { 20: 2000 }, JPY: { 20: 3000 } })
    expect(stripeTopUpDisplayAmount(prices, 'USD', 20)).toBe(20)
    expect(stripeTopUpDisplayAmount(prices, 'JPY', 20)).toBe(3000)
  })

  test('discards malformed and negative prices', () => {
    expect(
      parseStripeCurrencyPrices({
        USD: {
          20: 2000,
          50: -5000,
          invalid: 1200,
        },
        BRL: {
          20: '4000',
          50: null,
        },
        INR: 'not a price map',
      })
    ).toEqual({ USD: { 20: 2000 }, BRL: { 20: 4000 } })
  })
})

describe('currencySupportsPresetAmounts', () => {
  test('requires every visible preset to have a positive configured price', () => {
    const prices = parseStripeCurrencyPrices({
      USD: { 20: 2000, 50: 5000 },
      BRL: { 20: 10000 },
    })

    expect(currencySupportsPresetAmounts(prices, 'USD', [20, 50])).toBe(true)
    expect(currencySupportsPresetAmounts(prices, 'BRL', [20, 50])).toBe(false)
  })
})
