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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { CHANNEL_TYPE_NEW_API } from '../../constants'
import { channelSchema } from '../../types'
import { ChannelRowActionsLayoutContext } from '../channel-row-actions-context'
import { BalanceCell } from '../channels-columns'
import { ChannelsDialogs } from '../channels-dialogs'
import { ChannelsProvider } from '../channels-provider'

const originalAuth = useAuthStore.getState().auth
let client: QueryClient

// A multi-key channel whose stored balance is the sum of its keys.
function multiKeyChannel() {
  return channelSchema.parse({
    id: 42,
    type: CHANNEL_TYPE_NEW_API,
    key: '',
    name: 'Multi-key New API',
    status: 1,
    created_time: 1,
    test_time: 0,
    response_time: 0,
    balance: 12.34,
    balance_updated_time: 0,
    channel_info: { is_multi_key: true, multi_key_size: 2 },
  })
}

function renderBalanceCell(channel: ReturnType<typeof multiKeyChannel>) {
  render(
    <QueryClientProvider client={client}>
      <ChannelsProvider>
        <ChannelRowActionsLayoutContext.Provider value='table'>
          <BalanceCell channel={channel} />
        </ChannelRowActionsLayoutContext.Provider>
        <ChannelsDialogs />
      </ChannelsProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthStore.setState({
    auth: {
      ...originalAuth,
      user: { id: 1, username: 'root', role: ROLE.SUPER_ADMIN },
    },
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  useAuthStore.setState({ auth: originalAuth })
})

it('opens the balance dialog for a multi-key channel without querying it yet', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true } })
  const user = userEvent.setup()
  renderBalanceCell(multiKeyChannel())

  await user.click(screen.getByText(/12\.34/))

  expect(
    await screen.findByRole('dialog', { name: 'Query Balance' })
  ).toBeInTheDocument()
  expect(
    get.mock.calls.some(([url]) => String(url).includes('update_balance'))
  ).toBe(false)
})

it('lists every key with its own balance after a multi-key query', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (String(url).includes('update_balance')) {
      return {
        data: {
          success: true,
          balance: 3,
          keys: [
            { index: 0, key_preview: 'sk-aaaaaaaa...', balance: 1 },
            { index: 1, key_preview: 'sk-bbbbbbbb...', balance: 2 },
          ],
        },
      }
    }
    return { data: { success: true } }
  })
  const user = userEvent.setup()
  renderBalanceCell(multiKeyChannel())

  await user.click(screen.getByText(/12\.34/))
  await user.click(
    await screen.findByRole('button', { name: 'Update Balance' })
  )

  expect(await screen.findByText('Per-key balance')).toBeInTheDocument()
  expect(screen.getByText('#1')).toBeInTheDocument()
  expect(screen.getByText('#2')).toBeInTheDocument()
  expect(screen.getByText('sk-aaaaaaaa...')).toBeInTheDocument()
  expect(screen.getByText('sk-bbbbbbbb...')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('warns when a key did not report a balance and keeps the error visible', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (String(url).includes('update_balance')) {
      return {
        data: {
          success: true,
          balance: 2,
          keys: [
            {
              index: 0,
              key_preview: 'sk-broken...',
              error: 'status code: 401',
            },
            { index: 1, key_preview: 'sk-good', balance: 2 },
          ],
        },
      }
    }
    return { data: { success: true } }
  })
  const user = userEvent.setup()
  renderBalanceCell(multiKeyChannel())

  await user.click(screen.getByText(/12\.34/))
  await user.click(
    await screen.findByRole('button', { name: 'Update Balance' })
  )

  // Assert by role rather than by one language's full copy (web/AGENTS.md).
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.getByText('status code: 401')).toBeInTheDocument()
  expect(screen.getByText('sk-good')).toBeInTheDocument()
})
