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
import { afterEach, describe, expect, it } from 'vitest'

import type { PlanRecord } from '../../types'
import { SubscriptionPurchaseDialog } from '../dialogs/subscription-purchase-dialog'

// Persian currency amounts from Intl start with a left-to-right mark.
const LRM = '\u200e'

const plan = {
  plan: {
    id: 1,
    title: 'Pro',
    price_amount: 9.9,
    duration_unit: 'month',
    duration_value: 1,
    enabled: true,
    // 500000 quota units are $1 with the default currency settings.
    total_amount: 5_000_000,
  },
} as unknown as PlanRecord

function renderDialog(): void {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SubscriptionPurchaseDialog
        open
        onOpenChange={() => undefined}
        plan={plan}
        userQuota={2_500_000}
      />
    </QueryClientProvider>
  )
}

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('subscription purchase dialog price', () => {
  it('in English, keeps the amount due as before', async () => {
    await i18next.changeLanguage('en')
    renderDialog()
    expect(screen.getByText('$9.90')).toBeInTheDocument()
  })

  it('in Persian, writes the amount due with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    renderDialog()
    expect(screen.getByText('$۹٫۹۰')).toBeInTheDocument()
  })
})

describe('subscription purchase dialog quota amounts', () => {
  it('in English, keeps the plan quota, required and available amounts as before', async () => {
    await i18next.changeLanguage('en')
    renderDialog()
    expect(screen.getByText('$10')).toBeInTheDocument()
    expect(screen.getByText('$9.9')).toBeInTheDocument()
    expect(screen.getByText('$5')).toBeInTheDocument()
  })

  it('in Persian, writes the plan quota, required and available amounts with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    renderDialog()
    expect(screen.getByText(`${LRM}$۱۰`)).toBeInTheDocument()
    expect(screen.getByText(`${LRM}$۹٫۹`)).toBeInTheDocument()
    expect(screen.getByText(`${LRM}$۵`)).toBeInTheDocument()
  })
})
