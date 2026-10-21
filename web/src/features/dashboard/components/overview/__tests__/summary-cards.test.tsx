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
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { SummaryCards } from '../summary-cards'

let client: QueryClient
let cacheRate: number | null

beforeEach(() => {
  localStorage.clear()
  cacheRate = 95
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'cache-test-user',
    role: 1,
    quota: 1000000,
    used_quota: 1000,
    request_count: 7,
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/status') {
      return { data: { data: { display_in_currency: true } } }
    }
    if (url === '/api/data/self') {
      return { data: { success: true, data: [], cache_hit_rate: cacheRate } }
    }
    throw new Error(`Unexpected request: ${url}`)
  })
})

afterEach(() => {
  client.clear()
  useAuthStore.getState().auth.setUser(null)
})

async function renderSummary() {
  const router = createRouter({
    routeTree: createRootRoute({ component: SummaryCards }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await act(() => router.load())
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

it.each([
  [95, '95%'],
  [0, '0%'],
  [null, '—'],
] as const)(
  'adds the fourth user card with measured rate %s',
  async (rate, display) => {
    cacheRate = rate
    const view = await renderSummary()
    expect(await screen.findByText(display)).toBeVisible()
    for (const label of [
      'Historical Usage',
      'Request Count',
      'Cache hit rate',
    ]) {
      expect(screen.getByText(label)).toBeVisible()
    }
    expect(
      screen.getByText('Request Count').closest('.group')
    ).toHaveTextContent('7')
    expect(view.container.querySelector('.lg\\:grid-cols-4')).toHaveClass(
      'grid-cols-2'
    )
    expect(api.get).toHaveBeenCalledWith('/api/data/self', {
      params: expect.objectContaining({ include_cache_hit_rate: true }),
    })
  }
)

it('fetches a new rate when the current user changes', async () => {
  await renderSummary()
  expect(await screen.findByText('95%')).toBeVisible()
  cacheRate = 0
  act(() => {
    useAuthStore.getState().auth.setUser({
      id: 2,
      username: 'other-user',
      role: 1,
      quota: 0,
      used_quota: 0,
      request_count: 0,
    })
  })
  expect(await screen.findByText('0%')).toBeVisible()
  await waitFor(() => expect(screen.queryByText('95%')).not.toBeInTheDocument())
})
