import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SubscriptionPurchaseDialog } from '../subscription-purchase-dialog'

vi.mock('@/hooks/use-system-config', () => ({
  useSystemConfig: () => ({ currency: null }),
}))

describe('SubscriptionPurchaseDialog plan version display', () => {
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
