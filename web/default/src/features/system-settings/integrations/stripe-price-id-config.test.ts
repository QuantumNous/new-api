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
  buildStripeTopUpPriceRows,
  serializeStripeTopUpPriceIds,
} from './stripe-price-id-config'

describe('Stripe top-up price id config', () => {
  test('builds price id rows from configured top-up amount options', () => {
    expect(
      buildStripeTopUpPriceRows('[10, 20, 50]', '{"10":"price_10"}', {})
    ).toEqual([
      { amount: 10, priceId: 'price_10' },
      { amount: 20, priceId: '' },
      { amount: 50, priceId: '' },
    ])
  })

  test('uses legacy fixed-tier fields only when the dynamic map has no value', () => {
    expect(
      buildStripeTopUpPriceRows('[10, 20, 200]', '', {
        10: 'price_legacy_10',
        20: 'price_legacy_20',
        200: 'price_legacy_200',
      })
    ).toEqual([
      { amount: 10, priceId: 'price_legacy_10' },
      { amount: 20, priceId: 'price_legacy_20' },
      { amount: 200, priceId: 'price_legacy_200' },
    ])
  })

  test('serializes rows as an amount keyed JSON object', () => {
    expect(
      serializeStripeTopUpPriceIds([
        { amount: 10, priceId: ' price_10 ' },
        { amount: 20, priceId: '' },
        { amount: 50, priceId: 'price_50' },
      ])
    ).toBe('{\n  "10": "price_10",\n  "50": "price_50"\n}')
  })
})
