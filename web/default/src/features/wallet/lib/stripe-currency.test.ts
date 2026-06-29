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
import { getStripeCheckoutCurrencyForLanguage } from './stripe-currency'

describe('getStripeCheckoutCurrencyForLanguage', () => {
  test('routes Japanese language to JPY checkout', () => {
    expect(getStripeCheckoutCurrencyForLanguage('ja')).toBe('JPY')
    expect(getStripeCheckoutCurrencyForLanguage('ja-JP')).toBe('JPY')
  })

  test('routes Portuguese language to BRL checkout', () => {
    expect(getStripeCheckoutCurrencyForLanguage('pt')).toBe('BRL')
    expect(getStripeCheckoutCurrencyForLanguage('pt-BR')).toBe('BRL')
  })

  test('uses USD checkout for all other languages', () => {
    expect(getStripeCheckoutCurrencyForLanguage('en')).toBe('USD')
    expect(getStripeCheckoutCurrencyForLanguage('zh-CN')).toBe('USD')
    expect(getStripeCheckoutCurrencyForLanguage(undefined)).toBe('USD')
  })
})
