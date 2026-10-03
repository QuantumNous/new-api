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
import { render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ru from '@/i18n/locales/ru.json'

import { SubscriptionPlansCard } from '../subscription-plans-card'

// Local-time dates keep the expected YYYY-MM-DD HH:mm:ss text independent of
// the machine's time zone.
vi.mock('@/features/subscriptions/api', () => {
  const active = {
    subscription: {
      id: 7,
      plan_id: 1,
      status: 'active',
      start_time: new Date(2026, 9, 1, 9, 30).getTime() / 1000,
      end_time: new Date(2026, 10, 1, 9, 30).getTime() / 1000,
      next_reset_time: new Date(2026, 9, 8, 9, 30).getTime() / 1000,
      amount_total: 0,
      amount_used: 0,
    },
  }
  return {
    getPublicPlans: async () => ({ success: true, data: [] }),
    getSelfSubscriptionFull: async () => ({
      success: true,
      data: {
        billing_preference: 'subscription_first',
        subscriptions: [active],
        all_subscriptions: [active],
      },
    }),
    updateBillingPreference: async () => ({ success: true }),
  }
})

async function renderCard(language: string) {
  const i18n = createInstance()
  await i18n.init({
    lng: language,
    fallbackLng: 'en',
    resources: { en: { translation: {} }, ru },
    nsSeparator: false,
    interpolation: { escapeValue: false },
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={i18n}>
        <SubscriptionPlansCard topupInfo={null} />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 3, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('wallet subscription dates', () => {
  it.each(['en', 'ru'])(
    'shows the end date and next reset as YYYY-MM-DD HH:mm:ss in the %s interface',
    async (language) => {
      await renderCard(language)

      expect(
        await screen.findByText('2026-11-01 09:30:00', { exact: false })
      ).toBeInTheDocument()
      expect(
        screen.getByText('2026-10-08 09:30:00', { exact: false })
      ).toBeInTheDocument()
    }
  )
})
