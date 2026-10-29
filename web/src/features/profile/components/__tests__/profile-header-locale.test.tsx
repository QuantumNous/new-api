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

import type { UserProfile } from '../../types'
import { ProfileHeader } from '../profile-header'

// Default currency config: 500000 quota units = 1 USD, so the balance is $12.
const profile = {
  id: 1,
  username: 'profile-user',
  display_name: 'Profile User',
  role: 1,
  group: 'default',
  quota: 6_000_000,
  used_quota: 0,
  request_count: 0,
  status: 1,
} as UserProfile

beforeEach(() => {
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
})

afterEach(async () => {
  cleanup()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  await i18next.changeLanguage('en')
})

describe('ProfileHeader balance locale', () => {
  it('re-renders the balance with Persian digits after switching to Persian without a reload', async () => {
    await i18next.changeLanguage('en')
    render(<ProfileHeader profile={profile} loading={false} />)
    expect(screen.getByText('$12')).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('fa')
    })

    expect(screen.queryByText('$12')).not.toBeInTheDocument()
    expect(screen.getByText(/۱۲/)).toBeInTheDocument()
  })

  it('re-renders the balance with Latin digits after switching back to English', async () => {
    await i18next.changeLanguage('fa')
    render(<ProfileHeader profile={profile} loading={false} />)
    expect(screen.getByText(/۱۲/)).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('en')
    })

    expect(screen.getByText('$12')).toBeInTheDocument()
    expect(screen.queryByText(/۱۲/)).not.toBeInTheDocument()
  })
})
