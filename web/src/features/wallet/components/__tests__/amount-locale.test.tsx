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
import { act, cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import type { UserWalletData } from '../../types'
import { WalletStatsCard } from '../wallet-stats-card'

// Default currency config: 500000 quota units = 1 USD, so the balance is $12.
const user = {
  id: 1,
  username: 'wallet-user',
  quota: 6_000_000,
  used_quota: 0,
  request_count: 1532,
  aff_quota: 0,
  aff_history_quota: 0,
  aff_count: 0,
  aff_code: '',
  group: 'default',
} as UserWalletData

beforeEach(() => {
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
})

afterEach(async () => {
  cleanup()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  await i18next.changeLanguage('en')
})

describe('WalletStatsCard number locale', () => {
  it('re-renders the balance and request count with Persian digits after switching to Persian', async () => {
    await i18next.changeLanguage('en')
    render(<WalletStatsCard user={user} />)
    expect(screen.getByText('$12')).toBeInTheDocument()
    expect(screen.getByText('1,532')).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('fa')
    })

    expect(screen.queryByText('$12')).not.toBeInTheDocument()
    expect(screen.getByText(/۱۲/)).toBeInTheDocument()
    expect(screen.getByText('۱٬۵۳۲')).toBeInTheDocument()
  })

  it('re-renders the balance and request count with Latin digits after switching back to English', async () => {
    await i18next.changeLanguage('fa')
    render(<WalletStatsCard user={user} />)
    expect(screen.getByText('۱٬۵۳۲')).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('en')
    })

    expect(screen.getByText('$12')).toBeInTheDocument()
    expect(screen.getByText('1,532')).toBeInTheDocument()
    expect(screen.queryByText(/[۰-۹]/)).not.toBeInTheDocument()
  })
})
