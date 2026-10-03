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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { SummaryCards } from '../summary-cards'

let client: QueryClient

beforeEach(() => {
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  // 500000 quota units = 1 USD, so the remaining balance is $12.
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'dashboard-user',
    role: 1,
    quota: 6_000_000,
    used_quota: 0,
    request_count: 0,
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/status') return { data: { data: {} } }
    if (String(url).startsWith('/api/data/self')) {
      return { data: { success: true, data: [] } }
    }
    throw new Error(`Unexpected dashboard request: ${url}`)
  })
})

afterEach(async () => {
  cleanup()
  client.clear()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  await i18next.changeLanguage('en')
})

async function renderSummaryCards() {
  const router = createRouter({
    routeTree: createRootRoute({ component: SummaryCards }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('SummaryCards balance locale', () => {
  it('re-renders the remaining balance with Persian digits after switching to Persian', async () => {
    await i18next.changeLanguage('en')
    await renderSummaryCards()
    expect(await screen.findByText('$12')).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('fa')
    })

    expect(screen.queryByText('$12')).not.toBeInTheDocument()
    expect(screen.getByText(/۱۲/)).toBeInTheDocument()
  })

  it('re-renders the remaining balance with Latin digits after switching back to English', async () => {
    await i18next.changeLanguage('fa')
    await renderSummaryCards()
    expect(await screen.findByText(/۱۲/)).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('en')
    })

    expect(screen.getByText('$12')).toBeInTheDocument()
    expect(screen.queryByText(/۱۲/)).not.toBeInTheDocument()
  })
})
