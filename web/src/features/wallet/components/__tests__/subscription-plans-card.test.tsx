/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getPublicPlans,
  getSelfSubscriptionFull,
} from '@/features/subscriptions/api'
import type { UserSubscriptionRecord } from '@/features/subscriptions/types'

import { SubscriptionPlansCard } from '../subscription-plans-card'

vi.mock('@/features/subscriptions/api', () => ({
  getPublicPlans: vi.fn(),
  getSelfSubscriptionFull: vi.fn(),
  updateBillingPreference: vi.fn(),
}))

vi.mock(
  '@/features/subscriptions/components/dialogs/subscription-purchase-dialog',
  () => ({ SubscriptionPurchaseDialog: () => null })
)

const mockedGetPublicPlans = vi.mocked(getPublicPlans)
const mockedGetSelfSubscriptionFull = vi.mocked(getSelfSubscriptionFull)

function createSubscription(): UserSubscriptionRecord {
  return {
    subscription: {
      id: 11,
      user_id: 7,
      plan_id: 10,
      plan_title: 'Purchased weekly plan',
      plan_version: 2,
      status: 'active',
      source: 'order',
      start_time: Math.floor(Date.now() / 1000) - 60,
      end_time: Math.floor(Date.now() / 1000) + 86_400,
      amount_total: 500_000,
      amount_used: 0,
      window_amount: 100_000,
      quota_model_version: 1,
      total_amount_used: 0,
      window_amount_used: 0,
      historical_amount_used: 0,
    },
  }
}

afterEach(() => vi.clearAllMocks())

describe('SubscriptionPlansCard plan version display', () => {
  it('uses the purchased plan title and version for an active subscription', async () => {
    mockedGetPublicPlans.mockResolvedValue({ success: true, data: [] })
    mockedGetSelfSubscriptionFull.mockResolvedValue({
      success: true,
      data: {
        billing_preference: 'subscription_first',
        subscriptions: [createSubscription()],
        all_subscriptions: [createSubscription()],
      },
    })

    render(<SubscriptionPlansCard topupInfo={null} />)

    expect(await screen.findByText(/Purchased weekly plan/)).toBeInTheDocument()
    expect(screen.getByText(/Version 2/)).toBeInTheDocument()
  })
})
