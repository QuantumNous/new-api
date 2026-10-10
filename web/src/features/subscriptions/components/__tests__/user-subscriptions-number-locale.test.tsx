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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import type { PlanRecord, UserSubscriptionRecord } from '../../types'
import { UserSubscriptionsDialog } from '../dialogs/user-subscriptions-dialog'

// Persian currency amounts from Intl start with a left-to-right mark.
const LRM = '‎'

// 500000 quota units are $1 with the default currency settings.
const subscription = {
  subscription: {
    id: 1,
    plan_id: 1,
    status: 'active',
    source: 'admin',
    start_time: 1_790_000_000,
    end_time: 1_800_000_000,
    amount_total: 5_000_000,
    amount_used: 1_000_000,
  },
} as unknown as UserSubscriptionRecord

const plan = {
  plan: { id: 7, title: 'Pro', price_amount: 9.9 },
} as unknown as PlanRecord

function renderDialog(): void {
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    let data: unknown[] = []
    if (url.endsWith('/subscriptions')) data = [subscription]
    if (url.endsWith('/admin/plans')) data = [plan]
    return { data: { success: true, data } }
  })
  render(
    <UserSubscriptionsDialog
      open
      onOpenChange={() => undefined}
      user={{ id: 2, username: 'member' }}
    />
  )
}

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await i18next.changeLanguage('en')
})

describe('user subscriptions quota', () => {
  it('in English, keeps the used and total quota as before', async () => {
    await i18next.changeLanguage('en')
    renderDialog()
    expect(await screen.findByText('$2/$10')).toBeInTheDocument()
  })

  it('in Persian, writes the used and total quota with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    renderDialog()
    expect(await screen.findByText(`${LRM}$۲/${LRM}$۱۰`)).toBeInTheDocument()
  })
})

describe('plan selector price', () => {
  it.each([
    { language: 'English', lng: 'en', label: 'Pro ($9.90)' },
    { language: 'Persian', lng: 'fa', label: 'Pro ($۹٫۹۰)' },
  ])(
    'in $language, labels each plan with its price in the interface digits',
    async ({ lng, label }) => {
      const user = userEvent.setup()
      await i18next.changeLanguage(lng)
      renderDialog()
      await user.click(screen.getByRole('combobox'))
      expect(await screen.findByRole('option', { name: label })).toBeVisible()
    }
  )

  it('in Persian, adds the subscription with the numeric plan id', async () => {
    const user = userEvent.setup()
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { success: true, data: {} } })
    await i18next.changeLanguage('fa')
    renderDialog()
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Pro ($۹٫۹۰)' }))
    await user.click(screen.getByRole('button', { name: 'Add subscription' }))
    expect(post).toHaveBeenCalledWith(
      '/api/subscription/admin/users/2/subscriptions',
      { plan_id: 7 }
    )
  })
})
