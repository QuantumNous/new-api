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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { createAppQueryClient } from '@/lib/query-client'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { NodeSyncIndicator } from '../components/node-sync-indicator'
import type { NodeSync, NodeSyncNode, NodeSyncTopicState } from '../types'

const synced: NodeSyncTopicState = {
  synced: true,
  applied_at: 1730650000,
  error: '',
  errors: {},
}
const lagging: NodeSyncTopicState = { ...synced, synced: false, applied_at: 0 }

function node(
  name: string,
  topics: NodeSyncNode['topics'],
  online = true
): NodeSyncNode {
  return { node_name: name, online, topics }
}

function syncData(nodes: NodeSyncNode[]): NodeSync {
  return {
    topics: ['options', 'plugins', 'search_index'].map((topic) => ({
      topic,
      revision: 1,
      updated_at: 1730650000,
      updated_by: 'node-a',
    })),
    nodes,
  }
}

let response: NodeSync

beforeEach(() => {
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'root', role: ROLE.SUPER_ADMIN })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/system-info/sync') {
      return { data: { success: true, message: '', data: response } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
})

afterEach(() => {
  useAuthStore.getState().auth.setUser(null)
  vi.restoreAllMocks()
})

function renderIndicator(
  topics: string[],
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  render(
    <QueryClientProvider client={client}>
      <NodeSyncIndicator
        topics={topics}
        pluginNames={{ incho: 'Incho video' }}
      />
    </QueryClientProvider>
  )
  return client
}

test('one online node shows no indicator, even with an offline node listed', async () => {
  response = syncData([
    node('node-a', { options: synced }),
    node('node-b', { options: lagging }, false),
  ])
  renderIndicator(['options'])

  await waitFor(() => expect(api.get).toHaveBeenCalled())
  expect(screen.queryByRole('button')).toBeNull()
})

test('every online node synced on the watched topics shows up to date', async () => {
  response = syncData([
    node('node-a', { options: synced, plugins: lagging }),
    node('node-b', { options: synced, plugins: lagging }),
  ])
  renderIndicator(['options'])

  expect(
    await screen.findByRole('button', { name: 'Up to date on 2 nodes' })
  ).toBeVisible()
})

test('a node that has not loaded a watched topic shows the share updated', async () => {
  response = syncData([
    node('node-a', { options: synced }),
    node('node-b', { options: lagging }),
    node('node-c', { options: synced }),
  ])
  renderIndicator(['options'])

  expect(
    await screen.findByRole('button', { name: '2/3 nodes updated' })
  ).toBeVisible()
})

test('a load failure wins over updating and the list names each failure', async () => {
  const user = userEvent.setup()
  response = syncData([
    node('node-a', { options: lagging, plugins: synced }),
    node('node-b', {
      options: synced,
      plugins: {
        ...synced,
        errors: {
          incho: 'SyntaxError: Unexpected token',
          'local-tool': 'missing export',
        },
      },
    }),
    node('node-c', { options: { ...lagging, error: 'database is locked' } }),
  ])
  renderIndicator(['plugins', 'options'])

  await user.click(
    await screen.findByRole('button', { name: 'Failed on 2 nodes' })
  )

  const dialog = await screen.findByRole('dialog')
  const items = within(dialog).getAllByRole('listitem')
  const nodeA = items.find((item) => item.textContent?.startsWith('node-a'))
  const nodeB = items.find((item) => item.textContent?.startsWith('node-b'))
  const nodeC = items.find((item) => item.textContent?.startsWith('node-c'))
  expect(nodeA).toHaveTextContent('Updating')
  expect(nodeB).toHaveTextContent('Update failed')
  expect(nodeB).toHaveTextContent('Incho videoSyntaxError: Unexpected token')
  expect(nodeB).toHaveTextContent('local-toolmissing export')
  expect(nodeC).toHaveTextContent('Settingsdatabase is locked')
})

test('a topic the page does not know is named by its id', async () => {
  const user = userEvent.setup()
  response = syncData([
    node('node-a', { search_index: synced }),
    node('node-b', { search_index: { ...synced, error: 'index busy' } }),
  ])
  renderIndicator(['search_index'])

  await user.click(
    await screen.findByRole('button', { name: 'Failed on 1 nodes' })
  )

  expect(await screen.findByRole('dialog')).toHaveTextContent(
    'search_indexindex busy'
  )
})

test('a topic the server does not run shows no indicator', async () => {
  response = syncData([node('node-a', {}), node('node-b', {})])
  renderIndicator(['channels'])

  await waitFor(() => expect(api.get).toHaveBeenCalled())
  expect(screen.queryByRole('button')).toBeNull()
})

test('a user other than root sends no request and sees nothing', async () => {
  useAuthStore
    .getState()
    .auth.setUser({ id: 2, username: 'admin', role: ROLE.ADMIN })
  response = syncData([node('node-a', {}), node('node-b', {})])
  renderIndicator(['options'])

  await Promise.resolve()
  expect(api.get).not.toHaveBeenCalled()
  expect(screen.queryByRole('button')).toBeNull()
})

test('a saved change refetches the node states at once', async () => {
  response = syncData([
    node('node-a', { options: synced }),
    node('node-b', { options: synced }),
  ])
  const client = renderIndicator(['options'], createAppQueryClient())
  await screen.findByRole('button', { name: 'Up to date on 2 nodes' })

  response = syncData([
    node('node-a', { options: synced }),
    node('node-b', { options: lagging }),
  ])
  await client
    .getMutationCache()
    .build(client, { mutationFn: async () => 'saved' })
    .execute(undefined)

  expect(
    await screen.findByRole('button', { name: '1/2 nodes updated' })
  ).toBeVisible()
  client.clear()
})
