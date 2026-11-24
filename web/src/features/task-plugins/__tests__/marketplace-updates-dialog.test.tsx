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
import { createHash, webcrypto } from 'node:crypto'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { MarketplacePanel } from '../components/marketplace-panel'
import { DEFAULT_MARKETPLACE_INDEX_URL } from '../lib/marketplace'
import type {
  MarketplaceIndex,
  MarketplacePlugin,
  TaskPluginListItem,
} from '../types'

const api = vi.hoisted(() => ({
  listMarketplaceSources: vi.fn(),
  listTaskPlugins: vi.fn(),
  getTaskPlugin: vi.fn(),
  installMarketplacePlugin: vi.fn(),
  activateTaskPlugin: vi.fn(),
}))
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  ...api,
}))

const clients: QueryClient[] = []
const source = { name: 'Official', index_url: DEFAULT_MARKETPLACE_INDEX_URL }
const code = (key: string, version: string) => `// ${key} ${version}`
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

function openMarket(keys: string[]) {
  const plugins: MarketplacePlugin[] = keys.map((key) => ({
    key,
    name: key,
    latest: '2',
    task: key !== 'provider',
    provider: key === 'provider',
    versions: ['1', '2'].map((version) => ({
      version,
      path: `${key}/${version}.js`,
      sha256: hash(code(key, version)),
    })),
  }))
  const index: MarketplaceIndex = {
    name: 'Official catalog',
    indexVersion: 1,
    plugins,
  }
  const installed: TaskPluginListItem[] = keys.map((key) => ({
    meta: {
      key,
      name: key,
      version: '1',
      apiVersion: 1,
      author: { name: 'test' },
      models: null,
      fetchMode: 'per_task',
    },
    enabled: key !== 'disabled',
    active: true,
    source_hash: hash(code(key, '1')),
    source: 'override',
    runtime_status: 'registered',
    remark: '',
    in_flight_count: 0,
    channel_count: 0,
  }))
  api.listMarketplaceSources.mockResolvedValue([source])
  api.listTaskPlugins.mockImplementation(async () => installed)
  api.getTaskPlugin.mockImplementation(async (key: string) => ({
    source: code(key, '1'),
  }))
  const normalFetch = async (input: RequestInfo | URL) => {
    if (String(input) === source.index_url) return Response.json(index)
    const file = plugins.find((p) => String(input).endsWith(`/${p.key}/2.js`))
    return file
      ? new Response(code(file.key, '2'))
      : new Response('', { status: 404 })
  }
  const fetchMock = vi.fn(normalFetch)
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('crypto', webcrypto)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <MarketplacePanel kind='task' onKindChange={() => undefined} />
    </QueryClientProvider>
  )
  return { user: userEvent.setup(), fetchMock, normalFetch, index, installed }
}

afterEach(() => {
  for (const client of clients) client.clear()
  clients.length = 0
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

test('opens one review for the whole source, including other plugin kinds, and lets the administrator read a diff without installing', async () => {
  const { user, fetchMock } = openMarket(['alpha', 'disabled', 'provider'])
  await user.click(
    await screen.findByRole('button', { name: 'Update all (2)' })
  )
  const bulk = screen.getByRole('dialog', { name: 'Update installed plugins' })
  expect(
    within(bulk).getByRole('button', { name: 'Review provider' })
  ).toBeVisible()
  expect(fetchMock.mock.calls.every(([url]) => url === source.index_url)).toBe(
    true
  )
  const skips = within(bulk).getByRole('button', { name: 'Skipped (1)' })
  await user.click(skips)
  expect(skips).toHaveAttribute('aria-expanded', 'true')
  expect(within(bulk).getByText('Plugin is disabled')).toBeVisible()
  await user.click(within(bulk).getByRole('button', { name: 'Review alpha' }))
  const review = screen.getByRole('dialog', { name: 'alpha' })
  expect(
    within(review).getByRole('tab', { name: 'Changelog' })
  ).toHaveAttribute('aria-selected', 'true')
  expect(within(review).queryByRole('combobox')).toBeNull()
  await waitFor(() =>
    expect(review.contains(document.activeElement)).toBe(true)
  )
  expect(
    within(review).queryByRole('button', { name: 'Install and enable' })
  ).toBeNull()
  await user.click(
    within(review).getByRole('tab', { name: 'Version differences' })
  )
  expect(await within(review).findByText('+ // alpha 2')).toBeVisible()
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(
      within(bulk).getByRole('button', { name: 'Review alpha' })
    ).toHaveFocus()
  )
  await user.click(within(bulk).getByRole('button', { name: 'Cancel' }))
  expect(api.installMarketplacePlugin).not.toHaveBeenCalled()
})

test('continues after integrity and activation failures and reports the installed versions and skipped rows', async () => {
  const { user, fetchMock, normalFetch } = openMarket([
    'alpha',
    'beta',
    'disabled',
    'gamma',
  ])
  await user.click(
    await screen.findByRole('button', { name: 'Update all (3)' })
  )
  const bulk = screen.getByRole('dialog', { name: 'Update installed plugins' })
  let finish!: (value: Response) => void
  const pending = new Promise<Response>((resolve) => {
    finish = resolve
  })
  fetchMock.mockImplementation(async (url) =>
    String(url).endsWith('/alpha/2.js') ? pending : normalFetch(url)
  )
  api.installMarketplacePlugin.mockImplementation(
    async (request: { source: string }) => {
      const key = request.source === code('beta', '2') ? 'beta' : 'gamma'
      return {
        meta: { key, version: '2' },
        plugin: { active: key === 'gamma' },
      }
    }
  )
  api.activateTaskPlugin.mockRejectedValue(new Error('route conflict'))
  await user.click(within(bulk).getByRole('button', { name: 'Update all (3)' }))
  expect(await within(bulk).findByRole('progressbar')).toBeVisible()
  expect(within(bulk).getAllByText('Queued').length).toBeGreaterThan(0)
  expect(
    within(bulk).getByRole('button', { name: 'Updating...' })
  ).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(bulk).toBeVisible()
  finish(new Response('wrong bytes'))
  expect(
    await screen.findByText('1 updated · 2 failed · 1 skipped')
  ).toBeVisible()
  expect(within(bulk).getByText('Integrity check failed')).toBeVisible()
  expect(within(bulk).getByText('Updated successfully')).toBeVisible()
  expect(
    within(bulk).getByText('Uploaded, but activation failed.')
  ).toBeVisible()
  expect(within(bulk).getByText('route conflict')).toBeVisible()
  expect(
    api.installMarketplacePlugin.mock.calls.map(([request]) => [
      request.source,
      request.sourceSha256,
      request.marketplaceIndexUrl,
    ])
  ).toEqual(
    ['beta', 'gamma'].map((key) => [
      code(key, '2'),
      hash(code(key, '2')),
      source.index_url,
    ])
  )
  expect(api.activateTaskPlugin.mock.calls).toEqual([['beta', '2']])
})

test('rechecks disabled plugins, republished targets and withdrawals before sending any uploads', async () => {
  const { user, index, installed } = openMarket(['alpha', 'beta', 'gamma'])
  await user.click(
    await screen.findByRole('button', { name: 'Update all (3)' })
  )
  const bulk = screen.getByRole('dialog', { name: 'Update installed plugins' })
  installed[0] = { ...installed[0], enabled: false }
  index.plugins[1].versions[1].sha256 = hash('another build')
  index.revoked = [{ sha256: hash(code('gamma', '2')) }]
  await user.click(within(bulk).getByRole('button', { name: 'Update all (3)' }))
  expect(
    await screen.findByText('0 updated · 0 failed · 3 skipped')
  ).toBeVisible()
  expect(within(bulk).getByText('Plugin is disabled')).toBeVisible()
  expect(within(bulk).getByText('This release was withdrawn.')).toBeVisible()
  expect(
    within(bulk).getByText(
      'The installed plugin or the marketplace release changed after review.'
    )
  ).toBeVisible()
  expect(api.installMarketplacePlugin).not.toHaveBeenCalled()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('explains skipped plugins without offering an empty batch', async () => {
  const { user } = openMarket(['disabled'])
  await user.click(await screen.findByRole('button', { name: 'Skipped (1)' }))
  const bulk = screen.getByRole('dialog', { name: 'Update installed plugins' })
  expect(within(bulk).getByText('Plugin is disabled')).toBeVisible()
  expect(within(bulk).queryByRole('button', { name: /Update all/ })).toBeNull()
  expect(api.installMarketplacePlugin).not.toHaveBeenCalled()
})

test('keeps the batch available to retry when the source cannot be rechecked', async () => {
  const { user, fetchMock } = openMarket(['alpha'])
  await user.click(
    await screen.findByRole('button', { name: 'Update all (1)' })
  )
  const bulk = screen.getByRole('dialog', { name: 'Update installed plugins' })
  fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
  await user.click(within(bulk).getByRole('button', { name: 'Update all (1)' }))
  expect(await within(bulk).findByRole('alert')).toHaveTextContent('503')
  expect(api.installMarketplacePlugin).not.toHaveBeenCalled()
  api.installMarketplacePlugin.mockResolvedValue({ plugin: { active: true } })
  await user.click(within(bulk).getByRole('button', { name: 'Update all (1)' }))
  expect(
    await within(bulk).findByText('1 updated · 0 failed · 0 skipped')
  ).toBeVisible()
  expect(api.installMarketplacePlugin).toHaveBeenCalledTimes(1)
})
