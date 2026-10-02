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
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { CommonLogsFilterBar } from '../common-logs-filter-bar'
import { UsageLogsProvider } from '../usage-logs-provider'

function FilterFixture() {
  const table = useReactTable({
    data: [],
    columns: [],
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <UsageLogsProvider>
      <CommonLogsFilterBar table={table} />
    </UsageLogsProvider>
  )
}

async function renderFilterBar(initialEntry = '/usage-logs/common') {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/self/groups' || url === '/api/group/') {
      return {
        data: {
          success: true,
          data:
            url === '/api/group/'
              ? ['default', 'premium']
              : {
                  default: { desc: '', ratio: 1 },
                  premium: { desc: '', ratio: 2 },
                },
        },
      }
    }
    return { data: { success: true, data: { quota: 0, rpm: 0, tpm: 0 } } }
  })
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const logs = createRoute({
    getParentRoute: () => auth,
    path: '/usage-logs/$section',
    component: FilterFixture,
    validateSearch: (search: Record<string, unknown>) => search,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([logs])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await act(async () => {})
  return router
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  useAuthStore.getState().auth.setUser(null)
})

it('enables Reset once the applied window lags behind the current moment', async () => {
  const now = Date.now()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const end = now + 3600 * 1000

  vi.useFakeTimers()
  vi.setSystemTime(now)
  try {
    const router = await renderFilterBar(
      `/usage-logs/common?startTime=${dayStart.getTime()}&endTime=${end}`
    )
    // A freshly applied default window: nothing to reset yet.
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()

    // A few minutes pass; re-render so the default range recomputes against
    // the new clock, then Reset must become clickable and re-anchor to "now".
    vi.setSystemTime(new Date(now + 5 * 60 * 1000))
    fireEvent.click(screen.getByRole('button', { name: /^(Hide|Show)$/ }))
    await act(async () => {})

    const reset = screen.getByRole('button', { name: 'Reset' })
    expect(reset).toBeEnabled()

    fireEvent.click(reset)
    await act(async () => {})

    expect(router.state.location.search).toMatchObject({
      startTime: dayStart.getTime(),
      endTime: now + 5 * 60 * 1000 + 3600 * 1000,
    })
  } finally {
    vi.useRealTimers()
  }
})

it('enables Reset for a hand-picked range even without other filters', async () => {
  const now = Date.now()
  const start = now - 3 * 24 * 3600 * 1000
  const router = await renderFilterBar(
    `/usage-logs/common?startTime=${start}&endTime=${now + 3600 * 1000}`
  )
  const reset = screen.getByRole('button', { name: 'Reset' })
  expect(reset).toBeEnabled()

  await userEvent.click(reset)
  await waitFor(() => {
    const search = router.state.location.search as Record<string, unknown>
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    expect(search.startTime).toBe(dayStart.getTime())
    expect(search.endTime).toBeGreaterThanOrEqual(Date.now())
    expect(search.endTime).toBeLessThanOrEqual(
      Date.now() + 3600 * 1000 + 60_000
    )
  })
})
