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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SubscriptionPurchaseDialog } from '../components/dialogs/subscription-purchase-dialog'
import type { PlanRecord } from '../types'

vi.mock('@/lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }))

// A plan without a recurring Stripe price: only the Stripe-routed Alipay
// button (a one-time payment) can buy it through Stripe.
const planRecord: PlanRecord = {
  plan: {
    id: 7,
    title: 'Pro',
    price_amount: 10,
    currency: 'USD',
    duration_unit: 'month',
    duration_value: 1,
    enabled: true,
    total_amount: 1000,
    allow_balance_pay: true,
  } as PlanRecord['plan'],
}

const stripeMethods = [{ type: 'alipay', name: 'Alipay via Stripe' }]

function renderWithQueryClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

afterEach(() => {
  vi.mocked(api.post).mockReset()
  vi.restoreAllMocks()
})

describe('SubscriptionPurchaseDialog Stripe-routed methods', () => {
  test('with Stripe enabled, clicking a Stripe-routed Alipay method requests Stripe Checkout with that method', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        message: 'success',
        data: { pay_link: 'https://checkout.example/s' },
      },
    })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderWithQueryClient(
      <SubscriptionPurchaseDialog
        open
        onOpenChange={() => {}}
        plan={planRecord}
        enableStripe
        stripeMethods={stripeMethods}
      />
    )

    expect(screen.queryByRole('button', { name: 'Stripe' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Alipay via Stripe' }))

    await waitFor(() =>
      expect(open).toHaveBeenCalledWith('https://checkout.example/s', '_blank')
    )
    expect(vi.mocked(api.post).mock.calls[0]?.slice(0, 2)).toEqual([
      '/api/subscription/stripe/pay',
      { plan_id: 7, payment_method: 'alipay' },
    ])
  })

  test('with Stripe not enabled, Stripe-routed methods are hidden', () => {
    renderWithQueryClient(
      <SubscriptionPurchaseDialog
        open
        onOpenChange={() => {}}
        plan={planRecord}
        enableStripe={false}
        stripeMethods={stripeMethods}
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Alipay via Stripe' })
    ).toBeNull()
  })
})
