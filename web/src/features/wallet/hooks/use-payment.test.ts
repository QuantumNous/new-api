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

import { act, renderHook } from '@testing-library/react'
import { describe, test } from 'vitest'

import { PAYMENT_TYPES } from '../constants'
import type { AmountResponse } from '../types'
import {
  requestPaymentAmount,
  type PaymentAmountCalculators,
  usePayment,
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
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
      await requestPaymentAmount(40, PAYMENT_TYPES.WAFFO_PANCAKE, calculators),
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
      await requestPaymentAmount(40, PAYMENT_TYPES.WAFFO_PANCAKE, calculators),
      0
    )

    calculators.waffoPancake = async () => ({ success: true, data: '' })
    assert.equal(
      await requestPaymentAmount(40, PAYMENT_TYPES.WAFFO_PANCAKE, calculators),
      0
    )

    calculators.waffoPancake = async () => ({
      success: true,
      data: 'not-a-number',
    })
    assert.equal(
      await requestPaymentAmount(40, PAYMENT_TYPES.WAFFO_PANCAKE, calculators),
      0
    )
  })
})

describe('usePayment request ordering', () => {
  test('keeps the latest Stripe amount when an older request fails later', async () => {
    const olderRequest = deferred<AmountResponse>()
    const latestRequest = deferred<AmountResponse>()
    const calculators = createCalculators([])
    calculators.stripe = ({ amount }) =>
      amount === 2 ? olderRequest.promise : latestRequest.promise

    const { result } = renderHook(() => usePayment(calculators))

    let olderCalculation!: Promise<number>
    let latestCalculation!: Promise<number>
    act(() => {
      olderCalculation = result.current.calculatePaymentAmount(
        2,
        PAYMENT_TYPES.STRIPE
      )
      latestCalculation = result.current.calculatePaymentAmount(
        20,
        PAYMENT_TYPES.STRIPE
      )
    })

    await act(async () => {
      latestRequest.resolve({
        message: 'success',
        data: '20.00',
        currency: 'USD',
      })
      assert.equal(await latestCalculation, 20)
    })
    assert.equal(result.current.amount, 20)
    assert.equal(result.current.calculating, false)

    await act(async () => {
      olderRequest.resolve({ message: 'error', data: 'below minimum' })
      assert.equal(await olderCalculation, 0)
    })
    assert.equal(result.current.amount, 20)
    assert.equal(result.current.calculating, false)
  })

  test('does not let a failed Pancake calculation overwrite Stripe', async () => {
    const pancakeRequest = deferred<AmountResponse>()
    const stripeRequest = deferred<AmountResponse>()
    const calculators = createCalculators([])
    calculators.waffoPancake = () => pancakeRequest.promise
    calculators.stripe = () => stripeRequest.promise

    const { result } = renderHook(() => usePayment(calculators))

    let pancakeCalculation!: Promise<number>
    let stripeCalculation!: Promise<number>
    act(() => {
      pancakeCalculation = result.current.calculatePaymentAmount(
        20,
        PAYMENT_TYPES.WAFFO_PANCAKE
      )
      stripeCalculation = result.current.calculatePaymentAmount(
        20,
        PAYMENT_TYPES.STRIPE
      )
    })

    await act(async () => {
      stripeRequest.resolve({
        message: 'success',
        data: '20.00',
        currency: 'USD',
      })
      assert.equal(await stripeCalculation, 20)
    })

    await act(async () => {
      pancakeRequest.resolve({ message: 'error', data: 'invalid product' })
      assert.equal(await pancakeCalculation, 0)
    })

    assert.equal(result.current.amount, 20)
  })
})
