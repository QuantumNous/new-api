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
import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SubscriptionPlansCard } from '../subscription-plans-card'

vi.mock('@/features/subscriptions/api', () => ({
  getPublicPlans: async () => ({
    success: true,
    data: [
      {
        plan: {
          id: 1,
          title: 'Pro',
          price_amount: 9.9,
          duration_unit: 'month',
          duration_value: 1,
          enabled: true,
        },
      },
    ],
  }),
  getSelfSubscriptionFull: async () => ({
    success: true,
    data: { billing_preference: 'subscription_first', subscriptions: [] },
  }),
  updateBillingPreference: async () => ({ success: true }),
}))

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SubscriptionPlansCard topupInfo={null} />
    </QueryClientProvider>
  )
}

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('wallet plan card price', () => {
  it('in English, keeps the plan price as before', async () => {
    await i18next.changeLanguage('en')
    renderCard()
    expect(await screen.findByText('$9.90')).toBeInTheDocument()
  })

  it('in Persian, writes the plan price with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    renderCard()
    expect(await screen.findByText('$۹٫۹۰')).toBeInTheDocument()
  })
})
