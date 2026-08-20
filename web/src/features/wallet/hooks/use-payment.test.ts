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
import { describe, test } from 'node:test'

import { PAYMENT_TYPES } from '../constants'
import {
  canConfirmPayment,
  createPaymentQuoteController,
  getPaymentQuoteKey,
  requestPaymentAmount,
} from './use-payment'

const calculatorFor =
  (name: string, value: string, calls: string[], currency?: string) =>
  async (request: { amount: number }) => {
    calls.push(`${name}:${request.amount}`)
    return { success: true, data: value, ...(currency ? { currency } : {}) }
  }

const createCalculators = (calls: string[]) => ({
  regular: calculatorFor('regular', '1.25', calls),
  stripe: calculatorFor('stripe', '2.50', calls, 'USD'),
  waffo: calculatorFor('waffo', '3.75', calls),
  waffoPancake: calculatorFor('pancake', '4.50', calls, 'CNY'),
})

describe('payment amount routing', () => {
  test('uses the dedicated Waffo amount calculator', async () => {
    const calls: string[] = []
    const quote = await requestPaymentAmount(120, PAYMENT_TYPES.WAFFO, {
      regular: async () => {
        calls.push('regular')
        return { success: true, data: '1' }
      },
      stripe: async () => {
        calls.push('stripe')
        return { success: true, data: '2' }
      },
      waffo: async (request) => {
        calls.push(`waffo:${request.amount}`)
        return { success: true, data: '18.75' }
      },
      waffoPancake: async () => {
        calls.push('pancake')
        return { success: true, data: '4', currency: 'CNY' }
      },
    })

    assert.equal(quote.amount, 18.75)
    assert.equal(quote.currency, undefined)
    assert.deepEqual(calls, ['waffo:120'])
  })

  test('returns the server-confirmed Stripe currency with its quote', async () => {
    const quote = await requestPaymentAmount(
      20,
      PAYMENT_TYPES.STRIPE,
      createCalculators([])
    )

    assert.deepEqual(quote, { amount: 2.5, currency: 'USD' })
  })

  test('returns the server-confirmed Pancake currency with its quote', async () => {
    const quote = await requestPaymentAmount(
      40,
      PAYMENT_TYPES.WAFFO_PANCAKE,
      createCalculators([])
    )

    assert.deepEqual(quote, { amount: 4.5, currency: 'CNY' })
  })

  test('routes every gateway to its own calculator', async () => {
    const calls: string[] = []
    const calculators = createCalculators(calls)

    assert.equal(
      (await requestPaymentAmount(10, PAYMENT_TYPES.ALIPAY, calculators))
        .amount,
      1.25
    )
    assert.equal(
      (await requestPaymentAmount(20, PAYMENT_TYPES.STRIPE, calculators))
        .amount,
      2.5
    )
    assert.equal(
      (await requestPaymentAmount(30, PAYMENT_TYPES.WAFFO, calculators)).amount,
      3.75
    )
    assert.deepEqual(
      await requestPaymentAmount(40, PAYMENT_TYPES.WAFFO_PANCAKE, calculators),
      { amount: 4.5, currency: 'CNY' }
    )
    assert.deepEqual(calls, [
      'regular:10',
      'stripe:20',
      'waffo:30',
      'pancake:40',
    ])
  })

  test('rejects unsuccessful, malformed, zero, and negative quotes', async () => {
    const calls: string[] = []
    const calculators = createCalculators(calls)
    calculators.stripe = async () => ({
      success: false,
      message: 'Stripe quote failed',
      data: '9.99',
    })
    await assert.rejects(
      requestPaymentAmount(10, PAYMENT_TYPES.STRIPE, calculators),
      /Stripe quote failed/
    )

    for (const response of [
      { success: true, data: 'not-a-number', currency: 'CNY' },
      { success: true, data: '1abc', currency: 'CNY' },
      { success: true, data: '0', currency: 'CNY' },
      { success: true, data: '-1', currency: 'CNY' },
      { success: true, data: '4.50' },
      { success: true, data: '4.50', currency: 'cny' },
    ]) {
      calculators.waffoPancake = async () => response
      await assert.rejects(
        requestPaymentAmount(10, PAYMENT_TYPES.WAFFO_PANCAKE, calculators),
        /Payment amount calculation failed/
      )
    }

    calculators.stripe = async () => ({ success: true, data: '2.50' })
    await assert.rejects(
      requestPaymentAmount(10, PAYMENT_TYPES.STRIPE, calculators),
      /Payment amount calculation failed/
    )
  })
})

describe('payment quote keys', () => {
  test('separates quotes by gateway and amount', () => {
    assert.equal(getPaymentQuoteKey(PAYMENT_TYPES.STRIPE, 10), 'stripe:10')
    assert.equal(
      getPaymentQuoteKey(PAYMENT_TYPES.WAFFO_PANCAKE, 10),
      'waffo_pancake:10'
    )
    assert.notEqual(
      getPaymentQuoteKey(PAYMENT_TYPES.STRIPE, 10),
      getPaymentQuoteKey(PAYMENT_TYPES.STRIPE, 20)
    )
  })
})

describe('payment quote controller', () => {
  test('exposes loading state, coalesces requests, and reuses ready quotes', async () => {
    let calls = 0
    let resolveResponse!: (value: {
      success: boolean
      data: string
      currency?: string
    }) => void
    const pendingResponse = new Promise<{
      success: boolean
      data: string
      currency?: string
    }>((resolve) => {
      resolveResponse = resolve
    })
    const calculators = createCalculators([])
    calculators.stripe = async () => {
      calls += 1
      return pendingResponse
    }
    const controller = createPaymentQuoteController(calculators)

    const firstRequest = controller.calculate(10, PAYMENT_TYPES.STRIPE)
    assert.deepEqual(controller.getQuote(10, PAYMENT_TYPES.STRIPE), {
      paymentType: PAYMENT_TYPES.STRIPE,
      topupAmount: 10,
      status: 'loading',
    })

    const duplicateRequest = controller.calculate(10, PAYMENT_TYPES.STRIPE)
    assert.strictEqual(duplicateRequest, firstRequest)
    assert.equal(calls, 1)

    resolveResponse({ success: true, data: '2.50', currency: 'USD' })
    const readyQuote = await firstRequest
    assert.deepEqual(readyQuote, {
      paymentType: PAYMENT_TYPES.STRIPE,
      topupAmount: 10,
      amount: 2.5,
      currency: 'USD',
      status: 'ready',
    })
    assert.strictEqual(
      controller.getQuote(10, PAYMENT_TYPES.STRIPE),
      readyQuote
    )

    const cachedQuote = await controller.calculate(10, PAYMENT_TYPES.STRIPE)
    assert.strictEqual(cachedQuote, readyQuote)
    assert.equal(calls, 1)
  })

  test('retries failed quotes and keeps gateway and amount state separate', async () => {
    const calls: string[] = []
    const calculators = createCalculators(calls)
    let pancakeAttempts = 0
    calculators.waffoPancake = async (request) => {
      calls.push(`pancake:${request.amount}`)
      pancakeAttempts += 1
      if (pancakeAttempts === 1) {
        return { success: false, message: 'Pancake quote failed', data: '4.50' }
      }
      return { success: true, data: '4.50', currency: 'CNY' }
    }
    const controller = createPaymentQuoteController(calculators)

    assert.equal(
      (await controller.calculate(10, PAYMENT_TYPES.WAFFO_PANCAKE)).status,
      'error'
    )
    const pancakeQuote = await controller.calculate(
      10,
      PAYMENT_TYPES.WAFFO_PANCAKE
    )
    const stripeQuote = await controller.calculate(10, PAYMENT_TYPES.STRIPE)
    const largerStripeQuote = await controller.calculate(
      20,
      PAYMENT_TYPES.STRIPE
    )

    assert.deepEqual(calls, [
      'pancake:10',
      'pancake:10',
      'stripe:10',
      'stripe:20',
    ])
    assert.deepEqual(pancakeQuote, {
      paymentType: PAYMENT_TYPES.WAFFO_PANCAKE,
      topupAmount: 10,
      amount: 4.5,
      currency: 'CNY',
      status: 'ready',
    })
    assert.deepEqual(stripeQuote, {
      paymentType: PAYMENT_TYPES.STRIPE,
      topupAmount: 10,
      amount: 2.5,
      currency: 'USD',
      status: 'ready',
    })
    assert.deepEqual(largerStripeQuote, {
      paymentType: PAYMENT_TYPES.STRIPE,
      topupAmount: 20,
      amount: 2.5,
      currency: 'USD',
      status: 'ready',
    })
  })
})

describe('payment confirmation eligibility', () => {
  test('requires a selected method and an exact ready quote above its minimum', () => {
    const paymentMethod = { type: PAYMENT_TYPES.WAFFO_PANCAKE }
    const readyQuote = {
      paymentType: PAYMENT_TYPES.WAFFO_PANCAKE,
      topupAmount: 10,
      amount: 1.5,
      status: 'ready' as const,
    }

    assert.equal(canConfirmPayment(undefined, 10, 10, readyQuote), false)
    assert.equal(canConfirmPayment(paymentMethod, 9, 10, readyQuote), false)
    assert.equal(
      canConfirmPayment(paymentMethod, 10, 10, {
        ...readyQuote,
        status: 'loading' as const,
      }),
      false
    )
    assert.equal(
      canConfirmPayment(paymentMethod, 10, 10, {
        ...readyQuote,
        status: 'error' as const,
      }),
      false
    )
    assert.equal(
      canConfirmPayment({ type: PAYMENT_TYPES.STRIPE }, 10, 10, readyQuote),
      false
    )
    assert.equal(canConfirmPayment(paymentMethod, 20, 10, readyQuote), false)
    assert.equal(canConfirmPayment(paymentMethod, 10, 10, readyQuote), true)
  })
})
