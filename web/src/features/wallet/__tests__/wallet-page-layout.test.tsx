import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'

import { Wallet } from '../index'

vi.mock('@/components/dialog', () => ({ Dialog: () => null }))
vi.mock(
  '@/features/subscriptions/components/dialogs/subscription-purchase-dialog',
  () => ({
    SubscriptionPurchaseDialog: () => null,
  })
)
vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: null }),
}))
vi.mock('@/hooks/use-system-config', () => ({
  useSystemConfig: () => ({ currency: null }),
}))
vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))
vi.mock('@/lib/api', () => ({
  getSelf: vi.fn().mockResolvedValue({ success: false }),
}))
vi.mock('../hooks', () => ({
  useTopupInfo: () => ({ topupInfo: null, presetAmounts: [], loading: false }),
  usePayment: () => ({
    amount: 0,
    calculating: false,
    processing: false,
    calculatePaymentAmount: vi.fn(),
    processPayment: vi.fn(),
  }),
  useAffiliate: () => ({
    affiliateLink: '',
    loading: false,
    transferQuota: vi.fn(),
    transferring: false,
  }),
  useRedemption: () => ({ redeeming: false, redeemCode: vi.fn() }),
  useCreemPayment: () => ({ processing: false, processCreemPayment: vi.fn() }),
  useWaffoPayment: () => ({ processing: false, processWaffoPayment: vi.fn() }),
  useWaffoPancakePayment: () => ({
    processing: false,
    processWaffoPancakePayment: vi.fn(),
  }),
}))
vi.mock('../components/affiliate-rewards-card', () => ({
  AffiliateRewardsCard: () => null,
}))
vi.mock('../components/dialogs/billing-history-dialog', () => ({
  BillingHistoryDialog: ({ open }: { open: boolean }) => (
    <div data-testid='billing-history-state'>{String(open)}</div>
  ),
}))
vi.mock('../components/dialogs/creem-confirm-dialog', () => ({
  CreemConfirmDialog: () => null,
}))
vi.mock('../components/dialogs/payment-confirm-dialog', () => ({
  PaymentConfirmDialog: () => null,
}))
vi.mock('../components/dialogs/transfer-dialog', () => ({
  TransferDialog: () => null,
}))
vi.mock('../components/recharge-form-card', () => ({
  RechargeFormCard: () => null,
}))
vi.mock('../components/redemption-code-card', () => ({
  RedemptionCodeCard: () => null,
}))
vi.mock('../components/subscription-plans-card', () => ({
  SubscriptionPlansCard: () => null,
}))
vi.mock('../components/wallet-action-card', () => ({
  WalletActionCard: () => <div data-testid='wallet-action-card' />,
}))
vi.mock('../components/wallet-promotion-banner', () => ({
  WalletPromotionBanner: () => <div data-testid='wallet-promotion-banner' />,
}))
vi.mock('../components/wallet-stats-card', () => ({
  WalletStatsCard: ({ subscription }: { subscription?: ReactNode }) => (
    <div data-testid='wallet-stats-card'>{subscription}</div>
  ),
}))
vi.mock('../components/wallet-subscription-overview', () => ({
  WalletSubscriptionOverview: () => (
    <div data-testid='wallet-subscription-overview' />
  ),
}))

describe('wallet page layout', () => {
  test('does not show the retired order history entry or dialog', () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <Wallet />
      </QueryClientProvider>
    )

    expect(screen.getByRole('heading', { name: 'Wallet' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Order History' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('billing-history-state')
    ).not.toBeInTheDocument()
  })

  test('places wallet promotion between balance stats and payment actions', () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <Wallet />
      </QueryClientProvider>
    )

    const stats = screen.getByTestId('wallet-stats-card')
    const promotion = screen.getByTestId('wallet-promotion-banner')
    const firstAction = screen.getAllByTestId('wallet-action-card')[0]

    expect(stats.compareDocumentPosition(promotion)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(promotion.compareDocumentPosition(firstAction)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  test('places the subscription overview inside the wallet statistics grid', () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <Wallet />
      </QueryClientProvider>
    )

    const walletHeader = screen.getByTestId('wallet-header')
    const walletStats = within(walletHeader).getByTestId('wallet-stats-card')
    expect(
      within(walletStats).getByTestId('wallet-subscription-overview')
    ).toBeVisible()
  })
})
