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
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import type { UserSubscriptionRecord } from '../../types'
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

function renderDialog(): void {
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => ({
    data: {
      success: true,
      data: url.endsWith('/subscriptions') ? [subscription] : [],
    },
  }))
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
