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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import type { Channel } from '../../types'
import { ChannelsProvider } from '../channels-provider'
import { ChannelsTable } from '../channels-table'

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})
const clients: QueryClient[] = []

function channel(name: string): Channel {
  return {
    id: 3,
    type: 1,
    key: '',
    status: 1,
    name,
    created_time: 0,
    test_time: 0,
    response_time: 0,
    other: '',
    balance: 0,
    balance_updated_time: 0,
    models: 'gpt-4o',
    group: 'vip',
    used_quota: 0,
    other_info: '',
    remark: '',
    max_input_tokens: 0,
    channel_info: {
      is_multi_key: false,
      multi_key_size: 0,
      multi_key_polling_index: 0,
      multi_key_mode: 'random',
    },
    settings: '{}',
  }
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

async function renderChannelsPage(searchGate: () => Promise<void>) {
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/channel/search') {
      await searchGate()
      return {
        data: {
          success: true,
          data: { items: [channel('prod')], total: 1, type_counts: {} },
        },
      }
    }
    return { data: { success: true, data: ['vip'] } }
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const channelsRoute = createRoute({
    getParentRoute: () => auth,
    path: 'channels/',
    component: () => (
      <ChannelsProvider>
        <ChannelsTable />
      </ChannelsProvider>
    ),
  })
  const initialEntry =
    '/channels/?filter=prod&group=%5B%22vip%22%5D&status=%5B%22enabled%22%5D&model=gpt-4o'
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([channelsRoute])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  await router.load()
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>
  )
  expect((await screen.findAllByText('prod')).length).toBeGreaterThan(0)
  return get
}

it('refetches the channel list with the current filters and marks Refresh busy while it runs', async () => {
  let gate = Promise.resolve()
  const get = await renderChannelsPage(() => gate)
  const searchCalls = () =>
    get.mock.calls.filter(([url]) => url === '/api/channel/search')
  const refresh = screen.getByRole('button', { name: 'Refresh' })
  expect(searchCalls()).toHaveLength(1)
  expect(refresh).toHaveAttribute('aria-busy', 'false')

  let release!: () => void
  gate = new Promise((resolve) => {
    release = resolve
  })
  await userEvent.click(refresh)

  await waitFor(() => expect(searchCalls()).toHaveLength(2))
  expect(searchCalls()[1][1]?.params).toEqual(searchCalls()[0][1]?.params)
  expect(refresh).toHaveAttribute('aria-busy', 'true')
  release()
  await waitFor(() => expect(refresh).toHaveAttribute('aria-busy', 'false'))
})
