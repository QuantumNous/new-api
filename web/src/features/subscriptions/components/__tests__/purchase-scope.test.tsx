/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { SubscriptionPlan } from '../../types'
import { SubscriptionPurchaseDialog } from '../dialogs/subscription-purchase-dialog'

afterEach(cleanup)

const basePlan: SubscriptionPlan = {
  id: 8,
  partner_tenant_id: 0,
  title: 'Scoped plan',
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
  total_amount: 500000,
  upgrade_group: 'premium',
}

describe('subscription purchase scope', () => {
  it('shows the quota group separately from the upgrade group before payment', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SubscriptionPurchaseDialog
          open
          onOpenChange={() => {}}
          plan={{ plan: { ...basePlan, applicable_group: 'deepflash' } }}
        />
      </QueryClientProvider>
    )
    expect(await screen.findByText('Applicable Group')).toBeVisible()
    expect(screen.getByText('deepflash')).toBeVisible()
    expect(screen.getByText('Upgrade Group')).toBeVisible()
    expect(screen.getByText('premium')).toBeVisible()
  })

  it('identifies unrestricted quota before payment', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SubscriptionPurchaseDialog
          open
          onOpenChange={() => {}}
          plan={{ plan: basePlan }}
        />
      </QueryClientProvider>
    )
    expect(await screen.findByText('All groups')).toBeVisible()
  })
})
