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
import assert from 'node:assert/strict'
import { describe, test } from 'vitest'

import { PAYMENT_TYPES } from '../constants'
import {
  requestPaymentAmount,
  type PaymentAmountCalculators,
} from './use-payment'

function createCalculators(calls: string[]): PaymentAmountCalculators {
  return {
    regular: async ({ amount }) => {
      calls.push(`regular:${amount}`)
      return { success: true, data: '1.25' }
    },
    stripe: async ({ amount }) => {
      calls.push(`stripe:${amount}`)
      return { success: true, data: '2.50', currency: 'USD' }
    },
    waffo: async ({ amount }) => {
      calls.push(`waffo:${amount}`)
      return { success: true, data: '3.75' }
    },
    waffoPancake: async ({ amount }) => {
      calls.push(`pancake:${amount}`)
      return { success: true, data: '4.50', currency: 'CNY' }
    },
  }
}

describe('payment amount routing', () => {
  test('routes every gateway to its scalar amount calculator', async () => {
    const calls: string[] = []
    const calculators = createCalculators(calls)

    assert.equal(
      await requestPaymentAmount(10, PAYMENT_TYPES.ALIPAY, calculators),
      1.25
    )
    assert.equal(
      await requestPaymentAmount(20, PAYMENT_TYPES.STRIPE, calculators),
      2.5
    )
    assert.equal(
      await requestPaymentAmount(30, PAYMENT_TYPES.WAFFO, calculators),
      3.75
    )
    assert.equal(
      await requestPaymentAmount(
        40,
        PAYMENT_TYPES.WAFFO_PANCAKE,
        calculators
      ),
      4.5
    )

    assert.deepEqual(calls, [
      'regular:10',
      'stripe:20',
      'waffo:30',
      'pancake:40',
    ])
  })

  test('returns zero when an amount calculation is unsuccessful or empty', async () => {
    const calculators = createCalculators([])
    calculators.waffoPancake = async () => ({
      success: false,
      data: '4.50',
    })

    assert.equal(
      await requestPaymentAmount(
        40,
        PAYMENT_TYPES.WAFFO_PANCAKE,
        calculators
      ),
      0
    )

    calculators.waffoPancake = async () => ({ success: true, data: '' })
    assert.equal(
      await requestPaymentAmount(
        40,
        PAYMENT_TYPES.WAFFO_PANCAKE,
        calculators
      ),
      0
    )
  })
})
