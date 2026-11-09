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
import type { Row } from '@tanstack/react-table'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import type { TaskPluginOption } from '../../api'
import { channelSchema, type Channel } from '../../types'
import { ChannelsProvider } from '../channels-provider'
import { DataTableRowActions } from '../data-table-row-actions'

const originalAuth = useAuthStore.getState().auth
const pluginOptions: TaskPluginOption[] = [
  { key: 'with-balance', name: 'With balance', models: [], balance: true },
  { key: 'no-balance', name: 'No balance', models: [], balance: false },
]

beforeEach(() => {
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
    throw new Error(`Unexpected GET ${url}`)
  })
})

afterEach(() => {
  cleanup()
  useAuthStore.setState({ auth: originalAuth })
  vi.restoreAllMocks()
})

test.each([
  { name: 'a built-in channel', type: 1, plugin: '', shown: true },
  {
    name: 'a plugin that reports one',
    type: 61,
    plugin: 'with-balance',
    shown: true,
  },
  {
    name: 'a plugin that does not',
    type: 61,
    plugin: 'no-balance',
    shown: false,
  },
])(
  '"Query Balance" follows whether $name can report a balance',
  async (item) => {
    const channel: Channel = channelSchema.parse({
      id: 3,
      name: 'Channel',
      type: item.type,
      key: '',
      status: 1,
      created_time: 1,
      test_time: 0,
      response_time: 0,
      balance_updated_time: 0,
      setting: item.plugin
        ? JSON.stringify({ task_plugin_key: item.plugin })
        : '',
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChannelsProvider>
          <TooltipProvider>
            <DataTableRowActions row={{ original: channel } as Row<Channel>} />
          </TooltipProvider>
        </ChannelsProvider>
      </QueryClientProvider>
    )
    if (item.plugin) {
      await vi.waitFor(() =>
        expect(api.get).toHaveBeenCalledWith('/api/task_plugin_options')
      )
    }

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(
      await screen.findByRole('menuitem', { name: 'Test Connection' })
    ).toBeVisible()
    if (item.shown) {
      expect(
        await screen.findByRole('menuitem', { name: 'Query Balance' })
      ).toBeVisible()
    } else {
      expect(
        screen.queryByRole('menuitem', { name: 'Query Balance' })
      ).not.toBeInTheDocument()
    }
  }
)
