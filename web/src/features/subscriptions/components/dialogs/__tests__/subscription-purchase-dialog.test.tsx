import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  paySubscriptionBalance,
  paySubscriptionCreem,
  paySubscriptionEpay,
  paySubscriptionStripe,
  paySubscriptionWaffoPancake,
} from '../../../api'
import { SubscriptionPurchaseDialog } from '../subscription-purchase-dialog'

vi.mock('../../../api', () => ({
  paySubscriptionBalance: vi.fn().mockResolvedValue({ success: false }),
  paySubscriptionStripe: vi.fn().mockResolvedValue({ success: false }),
  paySubscriptionCreem: vi.fn().mockResolvedValue({ success: false }),
  paySubscriptionWaffoPancake: vi.fn().mockResolvedValue({ success: false }),
  paySubscriptionEpay: vi.fn().mockResolvedValue({ success: false }),
}))

vi.mock('@/hooks/use-system-config', () => ({
  useSystemConfig: () => ({ currency: null }),
}))

describe('SubscriptionPurchaseDialog plan version display', () => {
  it.each([
    ['Pay with Balance', paySubscriptionBalance],
    ['Stripe', paySubscriptionStripe],
    ['Creem', paySubscriptionCreem],
    ['Waffo Pancake', paySubscriptionWaffoPancake],
    ['Pay', paySubscriptionEpay],
  ] as const)(
    'submits the displayed version when paying with %s',
    async (button, method) => {
      render(
        <SubscriptionPurchaseDialog
          open
          onOpenChange={() => undefined}
          userQuota={10_000_000}
          enableStripe
          enableCreem
          enableWaffoPancake
          enableOnlineTopUp
          epayMethods={[{ type: 'alipay', name: 'Alipay' }]}
          plan={{
            plan_version_id: 42,
            version: 3,
            plan: {
              id: 10,
              title: 'Weekly plan',
              price_amount: 10,
              currency: 'USD',
              duration_unit: 'month',
              duration_value: 1,
              quota_reset_period: 'never',
              enabled: true,
              sort_order: 0,
              max_purchase_per_user: 0,
              total_amount: 500_000,
              allow_balance_pay: true,
              allow_wallet_overflow: true,
              window_amount: 0,
              quota_model_version: 1,
              stripe_price_id: 'price_test',
              creem_product_id: 'creem_test',
              waffo_pancake_product_id: 'waffo_test',
            },
          }}
        />
      )
      const payButton = screen.getByRole('button', { name: button })
      await waitFor(() => expect(payButton).toBeEnabled())
      fireEvent.click(payButton)
      await waitFor(() =>
        expect(method).toHaveBeenCalledWith(
          expect.objectContaining({ plan_id: 10, expected_plan_version_id: 42 })
        )
      )
    }
  )
  it('shows the current purchase version with the plan name', () => {
    render(
      <SubscriptionPurchaseDialog
        open
        onOpenChange={() => undefined}
        plan={{
          version: 3,
          plan: {
            id: 10,
            title: 'Weekly plan',
            price_amount: 10,
            currency: 'USD',
            duration_unit: 'month',
            duration_value: 1,
            quota_reset_period: 'never',
            enabled: true,
            sort_order: 0,
            allow_balance_pay: true,
            allow_wallet_overflow: true,
            max_purchase_per_user: 0,
            total_amount: 500_000,
            window_amount: 0,
            quota_model_version: 1,
          },
        }}
      />
    )

    expect(screen.getByText(/Weekly plan/)).toBeInTheDocument()
    expect(screen.getByText(/Version 3/)).toBeInTheDocument()
  })
})
