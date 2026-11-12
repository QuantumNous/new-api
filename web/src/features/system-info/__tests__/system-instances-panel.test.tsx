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
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { SystemInstancesPanel } from '../components/system-instances-panel'
import type {
  NodeSync,
  NodeSyncTopicState,
  SystemInstance,
  SystemInstanceStatus,
} from '../types'

const synced: NodeSyncTopicState = {
  synced: true,
  applied_at: 1730650000,
  error: '',
  errors: {},
}
const lagging: NodeSyncTopicState = { ...synced, synced: false, applied_at: 0 }
const applied = { revision: 1, applied_at: 1730650000 }

function instance(
  name: string,
  status: SystemInstanceStatus,
  withSync = true
): SystemInstance {
  return {
    node_name: name,
    status,
    stale_after_seconds: 90,
    started_at: 1730640000,
    last_seen_at: 1730650000,
    info: withSync ? { sync: { options: applied } } : {},
  }
}

const instances = [
  instance('node-a', 'online'),
  instance('node-b', 'online'),
  instance('node-c', 'online'),
  instance('node-d', 'stale'),
  instance('node-e', 'online', false),
]

const sync: NodeSync = {
  topics: ['options', 'plugins', 'search_index'].map((topic) => ({
    topic,
    revision: 1,
    updated_at: 1730650000,
    updated_by: 'node-a',
  })),
  nodes: [
    {
      node_name: 'node-a',
      online: true,
      topics: { options: synced, plugins: synced, search_index: synced },
    },
    {
      node_name: 'node-b',
      online: true,
      topics: { options: synced, plugins: lagging, search_index: synced },
    },
    {
      node_name: 'node-c',
      online: true,
      topics: {
        options: synced,
        plugins: { ...synced, errors: { incho: 'missing export' } },
        search_index: { ...lagging, error: 'index busy' },
      },
    },
    {
      node_name: 'node-d',
      online: false,
      topics: { options: synced, plugins: synced, search_index: synced },
    },
    {
      node_name: 'node-e',
      online: true,
      topics: { options: lagging, plugins: lagging, search_index: lagging },
    },
  ],
}

beforeEach(() => {
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'root', role: ROLE.SUPER_ADMIN })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/system-info/instances') {
      return { data: { success: true, message: '', data: instances } }
    }
    if (url === '/api/system-info/sync') {
      return { data: { success: true, message: '', data: sync } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
})

afterEach(() => {
  useAuthStore.getState().auth.setUser(null)
  vi.restoreAllMocks()
})

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <SystemInstancesPanel />
    </QueryClientProvider>
  )
}

async function syncCells() {
  await waitFor(() =>
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Synced')
  )
  const headers = screen.getAllByRole('columnheader')
  const column = headers.findIndex(
    (header) => header.textContent === 'Sync status'
  )
  return Object.fromEntries(
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => {
        const cells = within(row).getAllByRole('cell')
        return [cells[0].textContent?.match(/node-\w/)?.[0], cells[column]]
      })
  )
}

test('the sync column shows each online node as synced, updating or failed', async () => {
  renderPanel()
  const cells = await syncCells()

  expect(cells['node-a']).toHaveTextContent('Synced')
  expect(cells['node-b']).toHaveTextContent('Updating')
  expect(cells['node-c']).toHaveTextContent('Update failed')
})

test('an offline node or one that reports no sync shows a dash', async () => {
  renderPanel()
  const cells = await syncCells()

  expect(cells['node-d']).toHaveTextContent(/^-$/)
  expect(cells['node-e']).toHaveTextContent(/^-$/)
})

test('hovering a node lists each topic with its state and failures', async () => {
  const user = userEvent.setup()
  renderPanel()
  const cells = await syncCells()

  await user.hover(within(cells['node-c']).getByText('Update failed'))

  const tooltip = await waitFor(() => {
    const content = document.querySelector('[data-slot="tooltip-content"]')
    expect(content).not.toBeNull()
    return content as HTMLElement
  })
  const topics = within(tooltip).getAllByRole('listitem')
  expect(topics.map((topic) => topic.textContent)).toEqual([
    'SettingsSynced',
    'PluginsUpdate failedincho: missing export',
    'search_indexUpdate failedindex busy',
  ])
})
