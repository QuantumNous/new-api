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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import type { TaskPluginOption } from '../../api'
import { channelSchema, type ChannelBalanceDetail } from '../../types'
import { BalanceCell } from '../channels-columns'
import { ChannelsProvider } from '../channels-provider'

const originalAuth = useAuthStore.getState().auth
let client: QueryClient
const pluginOptions: TaskPluginOption[] = [
  { key: 'with-balance', name: 'With balance', models: [], balance: true },
  { key: 'no-balance', name: 'No balance', models: [], balance: false },
]

function pluginChannel(
  pluginKey: string,
  balanceDetail?: ChannelBalanceDetail | null
) {
  return channelSchema.parse({
    id: 5,
    name: 'Plugin channel',
    type: 61,
    key: '',
    status: 1,
    created_time: 1,
    test_time: 0,
    response_time: 0,
    balance: 3,
    balance_updated_time: 1_762_000_000,
    setting: JSON.stringify({ task_plugin_key: pluginKey }),
    balance_detail: balanceDetail,
  })
}

function renderCell(channel: ReturnType<typeof pluginChannel>) {
  return render(
    <QueryClientProvider client={client}>
      <ChannelsProvider>
        <BalanceCell channel={channel} />
      </ChannelsProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  useAuthStore.setState({
    auth: {
      ...originalAuth,
      user: { id: 1, username: 'root', role: ROLE.SUPER_ADMIN },
    },
  })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/task_plugin_options') {
      return { data: { success: true, data: pluginOptions } }
    }
    if (url === '/api/channel/update_balance/5') {
      return {
        data: {
          success: true,
          message: '',
          balance: 12,
          balance_detail: {
            amount: 88,
            currency: 'CNY',
            unlimited: false,
            windows: [],
          },
        },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  useAuthStore.setState({ auth: originalAuth })
  vi.restoreAllMocks()
})

test('a balance in another currency is shown in that currency, and a query reports it the same way', async () => {
  const success = vi.spyOn(toast, 'success')
  const user = userEvent.setup()
  renderCell(
    pluginChannel('with-balance', {
      amount: 42,
      currency: 'CNY',
      unlimited: false,
      windows: [],
    })
  )

  const badge = await screen.findByText('CN¥42')
  await user.click(badge)
  await waitFor(() =>
    expect(success).toHaveBeenCalledWith('Balance updated: CN¥88')
  )
})

test('an unlimited balance says so', async () => {
  renderCell(
    pluginChannel('with-balance', {
      amount: null,
      currency: 'USD',
      unlimited: true,
      windows: [],
    })
  )

  expect(await screen.findByText('Unlimited')).toBeInTheDocument()
})

test('a balance of limits only shows its fullest limit, and the hover lists every limit, the update time and the last error', async () => {
  const user = userEvent.setup()
  renderCell(
    pluginChannel('with-balance', {
      amount: null,
      currency: 'USD',
      unlimited: false,
      windows: [
        { name: '5-hour', used: 45, limit: 50, unit: 'requests' },
        { name: { en: 'Weekly', zh: '每周' }, used: 10, limit: 100 },
      ],
      error: 'Upstream answered 429',
    })
  )

  const badge = (await screen.findByText('90% used')).parentElement
  expect(badge).toHaveClass('text-destructive')
  expect(badge?.querySelector('svg')).not.toBeNull()

  await user.hover(screen.getByText('90% used'))
  expect(await screen.findByText(/^5-hour: 45 \/ 50 requests$/)).toBeVisible()
  expect(screen.getByText(/^Weekly: 10 \/ 100$/)).toBeVisible()
  expect(screen.getByText(/^Last updated:/)).toBeVisible()
  expect(screen.getByText('Last error: Upstream answered 429')).toBeVisible()
  expect(screen.getByText('Click to update balance')).toBeVisible()
})

test('a plugin channel whose plugin cannot query a balance shows none and offers no query', async () => {
  const user = userEvent.setup()
  renderCell(pluginChannel('no-balance'))

  await waitFor(() =>
    expect(api.get).toHaveBeenCalledWith('/api/task_plugin_options')
  )
  const badge = await screen.findByText('-')
  await user.hover(badge)
  const tooltip = await waitFor(() => {
    const content = document.querySelector('[data-slot="tooltip-content"]')
    expect(content).not.toBeNull()
    return content
  })
  expect(tooltip).toHaveTextContent(/-$/)
  expect(tooltip).not.toHaveTextContent('Click to update balance')
  await user.click(badge)
  expect(api.get).not.toHaveBeenCalledWith('/api/channel/update_balance/5')
})
