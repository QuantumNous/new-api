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
import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { PAYMENT_TYPES } from '../constants'
import { requestPaymentAmount, usePayment } from './use-payment'

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }))

describe('payment amount routing', () => {
  test('uses the dedicated Waffo amount calculator', async () => {
    const calls: string[] = []
    const amount = await requestPaymentAmount(
      120,
      { type: PAYMENT_TYPES.WAFFO },
      {
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
      }
    )

    expect(amount).toBe(18.75)
    expect(calls).toEqual(['waffo:120'])
  })
})

describe('payment amount routing by provider', () => {
  function recordingCalculators(calls: string[]) {
    return {
      regular: async () => {
        calls.push('regular')
        return { success: true, data: '1' }
      },
      stripe: async () => {
        calls.push('stripe')
        return { success: true, data: '2' }
      },
      waffo: async () => {
        calls.push('waffo')
        return { success: true, data: '3' }
      },
      waffoPancake: async () => {
        calls.push('pancake')
        return { success: true, data: '4' }
      },
    }
  }

  test('an Alipay entry routed through Stripe uses the Stripe amount calculator', async () => {
    const calls: string[] = []
    const amount = await requestPaymentAmount(
      50,
      { type: 'alipay', provider: 'stripe' },
      recordingCalculators(calls)
    )

    expect(amount).toBe(2)
    expect(calls).toEqual(['stripe'])
  })

  test('an Alipay entry without a provider keeps the Epay amount calculator', async () => {
    const calls: string[] = []
    const amount = await requestPaymentAmount(
      50,
      { type: 'alipay' },
      recordingCalculators(calls)
    )

    expect(amount).toBe(1)
    expect(calls).toEqual(['regular'])
  })
})

describe('payment request routing by provider', () => {
  afterEach(() => {
    vi.mocked(api.post).mockReset()
    vi.restoreAllMocks()
  })

  test('an Alipay entry routed through Stripe opens the Stripe Checkout link', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        message: 'success',
        data: { pay_link: 'https://checkout.example/s' },
      },
    })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const { result } = renderHook(() => usePayment())

    let success = false
    await act(async () => {
      success = await result.current.processPayment(50, {
        type: 'alipay',
        provider: 'stripe',
      })
    })

    expect(success).toBe(true)
    expect(vi.mocked(api.post).mock.calls[0]?.slice(0, 2)).toEqual([
      '/api/user/stripe/pay',
      { amount: 50, payment_method: 'alipay' },
    ])
    expect(open).toHaveBeenCalledWith('https://checkout.example/s', '_blank')
  })

  test('an Alipay entry without a provider is sent to the Epay order endpoint', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { message: 'error', data: 'Payment method does not exist' },
    })
    const { result } = renderHook(() => usePayment())

    await act(async () => {
      await result.current.processPayment(50, { type: 'alipay' })
    })

    expect(vi.mocked(api.post).mock.calls[0]?.slice(0, 2)).toEqual([
      '/api/user/pay',
      { amount: 50, payment_method: 'alipay' },
    ])
  })
})
