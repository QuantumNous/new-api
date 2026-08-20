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
  parseStripeCurrencyPrices,
  resolveEffectiveStripeCheckoutCurrency,
} from './lib'

describe('Wallet checkout currency resolution', () => {
  test('uses USD for both display and checkout when an inbound local currency lacks a visible preset', () => {
    const prices = parseStripeCurrencyPrices({
      USD: { 20: 2000, 50: 5000 },
      BRL: { 20: 9990 },
    })

    expect(
      resolveEffectiveStripeCheckoutCurrency({
        requestedCurrency: 'BRL',
        language: 'pt-BR',
        prices,
        presetAmounts: [20, 50],
        currencyTouched: true,
      })
    ).toBe('USD')
  })

  test('keeps a valid manual local currency instead of applying the language default', () => {
    const prices = parseStripeCurrencyPrices({
      USD: { 20: 2000, 50: 5000 },
      BRL: { 20: 9990, 50: 24990 },
      JPY: { 20: 3000, 50: 7500 },
    })

    expect(
      resolveEffectiveStripeCheckoutCurrency({
        requestedCurrency: 'BRL',
        language: 'ja-JP',
        prices,
        presetAmounts: [20, 50],
        currencyTouched: true,
      })
    ).toBe('BRL')
  })
})
