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
import { afterEach, expect, test, vi } from 'vitest'

import { TaskPlugins } from '..'
import { taskPluginsSearchSchema } from '../lib/plugin-kinds'
import type {
  MarketplaceIndex,
  TaskPluginListItem,
  TaskPluginParts,
} from '../types'

vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))

const INDEX_URL = 'https://plugins.example.com/index.json'

function installed(
  key: string,
  name: string,
  parts: TaskPluginParts
): TaskPluginListItem {
  return {
    meta: {
      key,
      name,
      version: '1.0.0',
      apiVersion: 1,
      author: { name: 'Example' },
      models: [],
      fetchMode: 'per_task',
    },
    source: 'override',
    enabled: true,
    active: true,
    source_hash: '',
    remark: '',
    runtime_status: 'registered',
    channel_count: 0,
    in_flight_count: 0,
    ...parts,
  }
}

const installedPlugins = [
  installed('kling', 'Kling', { task: true }),
  installed('relay', 'Relay', { task: false, provider: true }),
  installed('redact', 'Redact', { task: false, transform: true }),
  installed('acme', 'Acme', { task: true, transform: true }),
]

const marketplaceIndex: MarketplaceIndex = {
  indexVersion: 1,
  name: 'Example catalog',
  plugins: [
    { key: 'vidu', name: 'Vidu', task: true },
    { key: 'gateway', name: 'Gateway', task: false, provider: true },
    { key: 'filter', name: 'Filter', task: false, transform: true },
  ].map((plugin) => ({
    ...plugin,
    latest: '1.0.0',
    versions: [{ version: '1.0.0', path: `${plugin.key}/plugin.js` }],
  })),
}

let client: QueryClient
afterEach(() => {
  cleanup()
  client.clear()
  vi.unstubAllGlobals()
})

async function renderPluginsPage(
  initialEntry: string,
  plugins: TaskPluginListItem[] = installedPlugins
) {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
  client.setQueryData(['task-plugin-enabled'], true)
  client.setQueryData(['task-plugins'], plugins)
  client.setQueryData(
    ['task-plugin-marketplace-sources'],
    [{ name: 'Example', index_url: INDEX_URL }]
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(marketplaceIndex))
  )
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const page = createRoute({
    getParentRoute: () => auth,
    path: '/task-plugins/',
    validateSearch: taskPluginsSearchSchema,
    component: TaskPlugins,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([page])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { router, user: userEvent.setup() }
}

test('switching the kind shows only that kind and keeps it in the URL', async () => {
  const { router, user } = await renderPluginsPage('/task-plugins')

  expect(await screen.findByRole('button', { name: 'Task 2' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(screen.getByText('Kling')).toBeInTheDocument()
  expect(screen.queryByText('Relay')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Channel 1' }))

  expect(await screen.findByText('Relay')).toBeInTheDocument()
  expect(screen.queryByText('Kling')).toBeNull()
  expect(router.state.location.search).toEqual({ kind: 'provider' })
})

test('a kind in the URL opens that list, and a two-part plugin is under both kinds', async () => {
  const { user } = await renderPluginsPage('/task-plugins?kind=transform')

  expect(
    await screen.findByRole('button', { name: 'Request processing 2' })
  ).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Redact')).toBeInTheDocument()
  expect(screen.getByText('Acme')).toBeInTheDocument()
  expect(screen.queryByText('Kling')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Task 2' }))

  expect(await screen.findByText('Kling')).toBeInTheDocument()
  expect(screen.getByText('Acme')).toBeInTheDocument()
  expect(screen.queryByText('Redact')).toBeNull()
})

test('without task plugins the page opens on the first kind that has plugins', async () => {
  await renderPluginsPage('/task-plugins', [installedPlugins[1]])

  expect(
    await screen.findByRole('button', { name: 'Channel 1' })
  ).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Relay')).toBeInTheDocument()
})

test('marketplace items are split by the same kinds', async () => {
  const { router, user } = await renderPluginsPage('/task-plugins')

  await user.click(await screen.findByRole('tab', { name: 'Marketplace' }))

  expect(await screen.findByText('Vidu')).toBeInTheDocument()
  expect(screen.queryByText('Filter')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Request processing 1' }))

  expect(await screen.findByText('Filter')).toBeInTheDocument()
  expect(screen.queryByText('Vidu')).toBeNull()
  expect(screen.queryByText('Gateway')).toBeNull()
  await waitFor(() =>
    expect(router.state.location.search).toEqual({ kind: 'transform' })
  )
})
