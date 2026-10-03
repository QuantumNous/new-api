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
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SubscriptionPlansCard } from '../subscription-plans-card'

// One active and one expired subscription of a plan limited to two
// purchases, so the plan card shows its limit as reached. 500000 quota units
// are $1 with the default currency settings.
vi.mock('@/features/subscriptions/api', () => {
  const now = Math.floor(Date.now() / 1000)
  const active = {
    subscription: {
      id: 7,
      plan_id: 1,
      status: 'active',
      start_time: now - 86_400,
      end_time: now + 30 * 86_400,
      amount_total: 5_000_000,
      amount_used: 1_000_000,
    },
  }
  const expired = {
    subscription: {
      id: 6,
      plan_id: 1,
      status: 'expired',
      start_time: now - 60 * 86_400,
      end_time: now - 30 * 86_400,
      amount_total: 0,
      amount_used: 0,
    },
  }
  return {
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
            total_amount: 5_000_000,
            max_purchase_per_user: 2,
          },
        },
      ],
    }),
    getSelfSubscriptionFull: async () => ({
      success: true,
      data: {
        billing_preference: 'subscription_first',
        subscriptions: [active],
        all_subscriptions: [active, expired],
      },
    }),
    updateBillingPreference: async () => ({ success: true }),
  }
})

// Persian currency amounts from Intl start with a left-to-right mark.
const LRM = '\u200e'

function renderCard(): void {
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

describe('wallet subscription numbers', () => {
  it.each([
    {
      language: 'English',
      lng: 'en',
      texts: ['1 active', '1 expired', 'Used 20%', 'Purchase Limit: 2'],
    },
    {
      language: 'Persian',
      lng: 'fa',
      texts: ['۱ active', '۱ expired', 'Used ۲۰٪', 'Purchase Limit: ۲'],
    },
  ])(
    'in $language, writes the subscription counts, the used share and the purchase limit in the interface digits',
    async ({ lng, texts }) => {
      await i18next.changeLanguage(lng)
      renderCard()
      expect(await screen.findByText(texts[0])).toBeInTheDocument()
      for (const text of texts.slice(1)) {
        expect(screen.getByText(text)).toBeInTheDocument()
      }
    }
  )

  it.each([
    {
      language: 'English',
      lng: 'en',
      amount: '$2/$10 · Remaining $8',
      raw: 'Raw Quota: 1000000/5000000 · Remaining 4000000',
    },
    {
      language: 'Persian',
      lng: 'fa',
      amount: `${LRM}$۲/${LRM}$۱۰ · Remaining ${LRM}$۸`,
      raw: 'Raw Quota: ۱۰۰۰۰۰۰/۵۰۰۰۰۰۰ · Remaining ۴۰۰۰۰۰۰',
    },
  ])(
    'in $language, writes the raw quota tooltip in the same digits as the quota it explains',
    async ({ lng, amount, raw }) => {
      const user = userEvent.setup()
      await i18next.changeLanguage(lng)
      renderCard()
      await user.hover(await screen.findByText(amount))
      expect(await screen.findByText(raw)).toBeInTheDocument()
    }
  )

  it.each([
    { language: 'English', lng: 'en', text: 'Purchase limit reached (2/2)' },
    { language: 'Persian', lng: 'fa', text: 'Purchase limit reached (۲/۲)' },
  ])(
    'in $language, writes the purchase limit tooltip in the interface digits',
    async ({ lng, text }) => {
      const user = userEvent.setup()
      await i18next.changeLanguage(lng)
      renderCard()
      const button = await screen.findByRole('button', {
        name: 'Limit Reached',
      })
      await user.hover(button.parentElement as HTMLElement)
      expect(await screen.findByText(text)).toBeInTheDocument()
    }
  )
})
