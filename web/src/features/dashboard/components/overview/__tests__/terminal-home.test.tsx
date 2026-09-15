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
import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { formatConsoleMoney } from '@/lib/console-money'
import { useAuthStore } from '@/stores/auth-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'
import { renderApp } from '@/test-utils/render-app'

import { TerminalHome } from '../terminal-home'

const initialAuth = useAuthStore.getState()
let client: QueryClient
beforeEach(() => {
  useAuthStore.getState().auth.setBundle(createTestAuthBundle())
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['status'], {})
  client.setQueryData(['terminal', 'home', 'keys'], [])
})
afterEach(() => {
  client.clear()
  useAuthStore.setState(initialAuth)
  vi.restoreAllMocks()
})

it.each([
  [0, 700],
  [100, 700],
  [100, undefined],
])(
  'shows wallet spending %s separately from subscription quota %s',
  async (quota, subscriptionQuota) => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          requests: 1,
          quota,
          subscription_quota: subscriptionQuota,
          saved_quota: 0,
          daily: [],
        },
      },
    })
    await renderApp(<TerminalHome />, client)
    const label = await screen.findByText('Wallet spending today')
    const card = label.closest('article')
    expect(card).not.toBeNull()
    if (!card) throw new Error('Missing spending card')
    await waitFor(() =>
      expect(card.querySelector('strong')).toHaveTextContent(
        formatConsoleMoney(quota)
      )
    )
    expect(card).toHaveTextContent(
      `Subscription usage: ${subscriptionQuota ?? 0} quota units`
    )
  }
)
