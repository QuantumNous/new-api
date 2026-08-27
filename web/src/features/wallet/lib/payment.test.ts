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

import { describe, expect, test } from 'vitest'

import { PAYMENT_TYPES } from '../constants'
import type { TopupInfo } from '../types'
import {
  dispatchSelectedPayment,
  getDefaultPaymentType,
  getPaymentMethodMinTopup,
  isStripePayment,
  isWaffoPayment,
  isWaffoPancakePayment,
} from './payment'

describe('payment type classification', () => {
  test('keeps Waffo and Waffo Pancake on their dedicated flows', () => {
    expect(isWaffoPayment(PAYMENT_TYPES.WAFFO)).toBe(true)
    expect(isWaffoPayment(PAYMENT_TYPES.WAFFO_PANCAKE)).toBe(false)
    expect(isWaffoPancakePayment(PAYMENT_TYPES.WAFFO_PANCAKE)).toBe(true)
    expect(isWaffoPancakePayment(PAYMENT_TYPES.WAFFO)).toBe(false)
    expect(isStripePayment(PAYMENT_TYPES.STRIPE)).toBe(true)
  })
})

describe('default payment selection', () => {
  const topupInfo: TopupInfo = {
    enable_online_topup: false,
    enable_stripe_topup: true,
    pay_methods: [
      { name: 'Wechat Pay', type: PAYMENT_TYPES.WAFFO_PANCAKE },
      { name: 'Stripe', type: PAYMENT_TYPES.STRIPE },
    ],
    min_topup: 1,
    stripe_min_topup: 1,
    amount_options: [],
    discount: {},
    enable_waffo_pancake_topup: true,
    waffo_pancake_min_topup: 1,
  }

  test('does not let Pancake displace an existing scalar gateway', () => {
    assert.equal(getDefaultPaymentType(topupInfo), PAYMENT_TYPES.STRIPE)
  })

  test('keeps Pancake as the default when it is the only method', () => {
    assert.equal(
      getDefaultPaymentType({
        ...topupInfo,
        enable_stripe_topup: false,
        pay_methods: [topupInfo.pay_methods[0]],
      }),
      PAYMENT_TYPES.WAFFO_PANCAKE
    )
  })
})

describe('payment minimums', () => {
  const topupInfo: TopupInfo = {
    enable_online_topup: true,
    enable_stripe_topup: true,
    pay_methods: [],
    min_topup: 3,
    stripe_min_topup: 10,
    amount_options: [],
    discount: {},
    enable_waffo_topup: true,
    waffo_min_topup: 20,
    enable_waffo_pancake_topup: true,
    waffo_pancake_min_topup: 30,
  }

  test('uses the minimum belonging to the selected gateway', () => {
    assert.equal(
      getPaymentMethodMinTopup(topupInfo, undefined, PAYMENT_TYPES.STRIPE),
      10
    )
    assert.equal(
      getPaymentMethodMinTopup(topupInfo, undefined, PAYMENT_TYPES.WAFFO),
      20
    )
    assert.equal(
      getPaymentMethodMinTopup(
        topupInfo,
        undefined,
        PAYMENT_TYPES.WAFFO_PANCAKE
      ),
      30
    )
    assert.equal(
      getPaymentMethodMinTopup(topupInfo, undefined, PAYMENT_TYPES.ALIPAY),
      3
    )
  })

  test('honors a method-specific minimum when it is higher', () => {
    assert.equal(
      getPaymentMethodMinTopup(topupInfo, {
        name: 'Stripe',
        type: PAYMENT_TYPES.STRIPE,
        min_topup: 25,
      }),
      25
    )
  })
})

describe('payment dispatch', () => {
  test('keeps the selected Waffo method index through confirmation', async () => {
    const calls: string[] = []
    const success = await dispatchSelectedPayment(
      { name: 'Waffo Card', type: PAYMENT_TYPES.WAFFO },
      120,
      3,
      {
        regular: async () => {
          calls.push('regular')
          return false
        },
        waffo: async (amount, index) => {
          calls.push(`waffo:${amount}:${index}`)
          return true
        },
        waffoPancake: async () => {
          calls.push('pancake')
          return false
        },
      }
    )

    expect(success).toBe(true)
    expect(calls).toEqual(['waffo:120:3'])
  })

  test('sends Waffo Pancake only to its dedicated processor', async () => {
    const calls: string[] = []
    const success = await dispatchSelectedPayment(
      { name: 'Wechat Pay', type: PAYMENT_TYPES.WAFFO_PANCAKE },
      120,
      null,
      {
        regular: async () => {
          calls.push('regular')
          return false
        },
        waffo: async () => {
          calls.push('waffo')
          return false
        },
        waffoPancake: async (amount) => {
          calls.push(`pancake:${amount}`)
          return true
        },
      }
    )

    expect(success).toBe(true)
    expect(calls).toEqual(['pancake:120'])
  })

  test('sends ordinary methods only to the regular processor', async () => {
    const calls: string[] = []
    const success = await dispatchSelectedPayment(
      { name: 'Alipay', type: PAYMENT_TYPES.ALIPAY },
      120,
      null,
      {
        regular: async (amount, type) => {
          calls.push(`regular:${amount}:${type}`)
          return true
        },
        waffo: async () => {
          calls.push('waffo')
          return false
        },
        waffoPancake: async () => {
          calls.push('pancake')
          return false
        },
      }
    )

    expect(success).toBe(true)
    expect(calls).toEqual(['regular:120:alipay'])
  })

  test('does not create a Waffo order without a selected method index', async () => {
    let called = false
    const success = await dispatchSelectedPayment(
      { name: 'Waffo Card', type: PAYMENT_TYPES.WAFFO },
      120,
      null,
      {
        regular: async () => false,
        waffo: async () => {
          called = true
          return true
        },
        waffoPancake: async () => false,
      }
    )

    expect(success).toBe(false)
    expect(called).toBe(false)
  })
})
