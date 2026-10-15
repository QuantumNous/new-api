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
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { calculateAmount, requestWechatPayPayment } from '../api'
import { PAYMENT_TYPES } from '../constants'
import type { AmountResponse } from '../types'
import { requestPaymentAmount, usePayment } from './use-payment'

vi.mock('../api', () => ({
  calculateAmount: vi.fn(),
  calculateAlipayAmount: vi.fn(),
  calculateWechatPayAmount: vi.fn(),
  requestWechatPayPayment: vi.fn(),
  requestAlipayPayment: vi.fn(),
  calculateStripeAmount: vi.fn(),
  calculateWaffoAmount: vi.fn(),
  calculateWaffoPancakeAmount: vi.fn(),
  requestPayment: vi.fn(),
  requestStripePayment: vi.fn(),
  isApiSuccess: (response: { success?: boolean }) => !!response.success,
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('payment amount routing', () => {
  test('routes direct Alipay quotes independently of Epay', async () => {
    const regular = vi.fn()
    const alipay = vi.fn().mockResolvedValue({ success: true, data: '7.01' })
    expect(
      await requestPaymentAmount(1, PAYMENT_TYPES.ALIPAY_DIRECT, {
        alipay,
        regular,
        stripe: regular,
        waffo: regular,
        waffoPancake: regular,
      })
    ).toBe(7.01)
    expect(alipay).toHaveBeenCalledWith({ amount: 1 })
    expect(regular).not.toHaveBeenCalled()
  })

  test('routes direct WeChat Pay quotes independently of Epay', async () => {
    const regular = vi.fn()
    const wechatpay = vi.fn().mockResolvedValue({ success: true, data: '7.01' })
    expect(
      await requestPaymentAmount(1, 'wechatpay_native', {
        wechatpay,
        regular,
        stripe: regular,
        waffo: regular,
        waffoPancake: regular,
      })
    ).toBe(7.01)
    expect(wechatpay).toHaveBeenCalledWith({ amount: 1 })
    expect(regular).not.toHaveBeenCalled()
  })

  test('uses the dedicated Waffo amount calculator', async () => {
    const calls: string[] = []
    const amount = await requestPaymentAmount(120, PAYMENT_TYPES.WAFFO, {
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
        return { success: true, data: '4' }
      },
    })

    expect(amount).toBe(18.75)
    expect(calls).toEqual(['waffo:120'])
  })

  test('retains the latest payment amount when an earlier calculation resolves last', async () => {
    let resolveFirst: (response: AmountResponse) => void = () => undefined
    let resolveSecond: (response: AmountResponse) => void = () => undefined
    vi.mocked(calculateAmount)
      .mockImplementationOnce(
        () =>
          new Promise<AmountResponse>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<AmountResponse>((resolve) => {
            resolveSecond = resolve
          })
      )
    const { result } = renderHook(() => usePayment())

    let firstCalculation: Promise<number>
    let secondCalculation: Promise<number>
    act(() => {
      firstCalculation = result.current.calculatePaymentAmount(10, 'first')
      secondCalculation = result.current.calculatePaymentAmount(20, 'second')
    })

    await act(async () => {
      resolveSecond({ success: true, data: '20' })
      await secondCalculation
    })

    expect(result.current.amount).toBe(20)
    expect(result.current.calculating).toBe(false)

    await act(async () => {
      resolveFirst({ success: true, data: '10' })
      await firstCalculation
    })

    expect(result.current.amount).toBe(20)
    expect(result.current.calculating).toBe(false)
  })
})

test('direct channel checkout uses the quote obtained for this click instead of stale hook state', async () => {
  vi.mocked(requestWechatPayPayment).mockResolvedValue({
    success: true,
    data: {
      trade_no: 'WX-current',
      amount: '7.25',
      currency: 'CNY',
      expires_at: 4102444800,
      code_url: 'weixin://wxpay/current',
    },
  })
  const { result } = renderHook(() => usePayment())
  await act(async () => {
    await result.current.processPayment(10, 'wechatpay_native', 7.25)
  })
  expect(requestWechatPayPayment).toHaveBeenCalledWith(10, '7.25')
  expect(result.current.wechatCheckout?.trade_no).toBe('WX-current')
})
