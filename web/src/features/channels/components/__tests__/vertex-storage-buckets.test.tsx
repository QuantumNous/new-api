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
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { channelSchema, type Channel } from '../../types'
import { ChannelsProvider } from '../channels-provider'
import { ChannelMutateDrawer } from '../drawers/channel-mutate-drawer'

const VERTEX_AI_CHANNEL_TYPE = 41
const originalAuth = useAuthStore.getState().auth
let client: QueryClient
let vertexChannel: Channel

function DrawerHarness(props: { currentRow: Channel }) {
  const [open, setOpen] = useState(true)
  return (
    <QueryClientProvider client={client}>
      <ChannelsProvider>
        <ChannelMutateDrawer
          open={open}
          onOpenChange={setOpen}
          currentRow={props.currentRow}
        />
      </ChannelsProvider>
    </QueryClientProvider>
  )
}

function renderVertexChannel(models: string) {
  vertexChannel.models = models
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  render(<DrawerHarness currentRow={vertexChannel} />)
  return { put, user: userEvent.setup() }
}

beforeEach(() => {
  vertexChannel = channelSchema.parse({
    id: 42,
    name: 'Vertex channel',
    type: VERTEX_AI_CHANNEL_TYPE,
    key: '',
    status: 1,
    created_time: 1,
    test_time: 0,
    response_time: 0,
    balance_updated_time: 0,
    models: 'gemini-2.5-pro',
    group: 'default',
    // Vertex AI channels require the region/project configuration to save.
    other: 'us-central1',
  })
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
    if (url === '/api/channel/42') {
      return { data: { success: true, data: vertexChannel } }
    }
    if (url === '/api/channel/models') {
      return { data: { success: true, data: [{ id: 'gemini-2.5-pro' }] } }
    }
    if (url === '/api/channel/default_base_urls') {
      return { data: { success: true, data: {} } }
    }
    if (url === '/api/group/') {
      return { data: { success: true, data: ['default'] } }
    }
    if (url === '/api/prefill_group') {
      return { data: { success: true, data: [] } }
    }
    if (url === '/api/task_plugin_options') {
      return { data: { success: true, data: [] } }
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

test('a configured bucket is shown in the storage field instead of the model list', async () => {
  renderVertexChannel('gemini-2.5-pro,storage:gs:example-bucket')
  await screen.findByDisplayValue('Vertex channel')

  expect(screen.getByRole('button', { name: 'gemini-2.5-pro' })).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'storage:gs:example-bucket' })
  ).not.toBeInTheDocument()
  expect(screen.getByText('example-bucket')).toBeVisible()
})

test('clearing all models keeps the configured buckets and saves them back', async () => {
  const { put, user } = renderVertexChannel(
    'gemini-2.5-pro,storage:gs:example-bucket'
  )
  await screen.findByDisplayValue('Vertex channel')

  await user.click(screen.getByRole('button', { name: 'Clear All' }))
  expect(
    screen.queryByRole('button', { name: 'gemini-2.5-pro' })
  ).not.toBeInTheDocument()
  expect(screen.getByText('example-bucket')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Update Channel' }))
  await waitFor(() => expect(put).toHaveBeenCalled())
  expect(put.mock.calls[0]?.[1]).toMatchObject({
    id: 42,
    models: 'storage:gs:example-bucket',
  })
})

test('adding a bucket saves it as a storage model next to the models', async () => {
  const { put, user } = renderVertexChannel('gemini-2.5-pro')
  await screen.findByDisplayValue('Vertex channel')

  await user.type(
    screen.getByRole('combobox', { name: 'Enter storage bucket names' }),
    'example-bucket,'
  )
  await user.keyboard('{Escape}')
  expect(screen.getByText('example-bucket')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Update Channel' }))
  await waitFor(() => expect(put).toHaveBeenCalled())
  expect(put.mock.calls[0]?.[1]).toMatchObject({
    id: 42,
    models: 'gemini-2.5-pro,storage:gs:example-bucket',
  })
})

test('a non-Vertex channel does not expose the storage bucket field', async () => {
  vertexChannel.type = 1
  render(<DrawerHarness currentRow={vertexChannel} />)
  await screen.findByDisplayValue('Vertex channel')

  expect(
    screen.queryByRole('combobox', { name: 'Enter storage bucket names' })
  ).not.toBeInTheDocument()
})
