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
import { afterEach, describe, expect, it } from 'vitest'

import type { UserWalletData } from '../../types'
import { AffiliateRewardsCard } from '../affiliate-rewards-card'

// 500000 quota units are $1 with the default currency settings.
const user = {
  id: 1,
  username: 'wallet-user',
  quota: 0,
  used_quota: 0,
  request_count: 0,
  aff_quota: 1_000_000,
  aff_history_quota: 2_500_000,
  aff_count: 1234,
  aff_code: 'code',
  group: 'default',
} as UserWalletData

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('affiliate rewards invites', () => {
  it.each([
    { language: 'English', lng: 'en', invites: '1234' },
    { language: 'Persian', lng: 'fa', invites: '۱۲۳۴' },
  ])(
    'in $language, writes the invite count in the interface digits',
    async ({ lng, invites }) => {
      await i18next.changeLanguage(lng)
      render(
        <AffiliateRewardsCard
          user={user}
          affiliateLink='https://example.com/?aff=code'
          onTransfer={() => undefined}
        />
      )
      expect(screen.getByText(invites)).toBeInTheDocument()
    }
  )
})
