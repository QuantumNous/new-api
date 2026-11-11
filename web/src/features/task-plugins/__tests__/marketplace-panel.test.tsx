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
import { afterEach, describe, expect, test, vi } from 'vitest'

import { usePluginSiteStore } from '@/stores/plugin-site-store'

import type { MarketplaceInstallTarget } from '../components/marketplace-install-dialog'
import { MarketplacePanel } from '../components/marketplace-panel'
import {
  COMMUNITY_MARKETPLACE_INDEX_URL,
  DEFAULT_MARKETPLACE_INDEX_URL,
  GITHUB_MARKETPLACE_INDEX_URL,
} from '../lib/marketplace'
import type { MarketplaceIndex, MarketplaceSource } from '../types'

vi.mock('../components/marketplace-install-dialog', () => ({
  MarketplaceInstallDialog: (props: {
    target: MarketplaceInstallTarget | null
  }) =>
    props.target ? (
      <p>
        Installing {props.target.plugin.key} from {props.target.source.name}
      </p>
    ) : null,
}))
vi.mock('../components/marketplace-plugin-card', () => ({
  MarketplacePluginCard: (props: {
    plugin: { key: string }
    onInstall: () => void
  }) => (
    <button type='button' onClick={props.onInstall}>
      Card {props.plugin.key}
    </button>
  ),
}))
vi.mock('../components/marketplace-sources-dialog', () => ({
  MarketplaceSourcesDialog: (props: { open: boolean }) =>
    props.open ? <p>Sources dialog open</p> : null,
}))

const officialSource: MarketplaceSource = {
  name: 'Official',
  index_url: DEFAULT_MARKETPLACE_INDEX_URL,
}
const githubSource: MarketplaceSource = {
  name: 'GitHub',
  index_url: GITHUB_MARKETPLACE_INDEX_URL,
}

const officialIndex: MarketplaceIndex = {
  indexVersion: 1,
  name: 'Official catalog',
  plugins: [],
}
const githubIndex: MarketplaceIndex = {
  indexVersion: 1,
  name: 'GitHub catalog',
  plugins: [],
}

const queryClients: QueryClient[] = []

function renderPanel(
  sources: MarketplaceSource[] = [officialSource, githubSource]
): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
  queryClient.setQueryData(['task-plugin-marketplace-sources'], sources)
  queryClient.setQueryData(['task-plugins'], [])
  queryClients.push(queryClient)

  render(
    <QueryClientProvider client={queryClient}>
      <MarketplacePanel onKindChange={() => undefined} />
    </QueryClientProvider>
  )
  return queryClient
}

function requestedUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input))
}

function installIndexFetchMock() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const index =
      url === GITHUB_MARKETPLACE_INDEX_URL ? githubIndex : officialIndex
    return new Response(JSON.stringify(index), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sourceMenu(): HTMLElement {
  return screen.getByRole('button', { name: 'Plugin download site' })
}

async function menuChoices(user: ReturnType<typeof userEvent.setup>) {
  await user.click(sourceMenu())
  const names = screen
    .getAllByRole('menuitemradio')
    .map((item) => item.textContent)
  await user.keyboard('{Escape}')
  return names
}

afterEach(() => {
  for (const queryClient of queryClients) queryClient.clear()
  queryClients.length = 0
  vi.unstubAllGlobals()
  usePluginSiteStore.setState({ site: 'ai' })
})

describe('MarketplacePanel source switch', () => {
  test('selects only the official source by default and hides both URLs', async () => {
    const fetchMock = installIndexFetchMock()
    renderPanel()

    expect(
      await screen.findByRole('heading', {
        name: officialIndex.name,
      })
    ).toBeInTheDocument()
    expect(screen.queryByText(DEFAULT_MARKETPLACE_INDEX_URL)).toBeNull()
    expect(screen.queryByText(GITHUB_MARKETPLACE_INDEX_URL)).toBeNull()
    expect(sourceMenu()).toHaveTextContent('Main site (www.newapi.ai)')
    expect(requestedUrls(fetchMock)).toContain(DEFAULT_MARKETPLACE_INDEX_URL)
    expect(requestedUrls(fetchMock)).not.toContain(GITHUB_MARKETPLACE_INDEX_URL)
  })

  test('loads GitHub only after the administrator switches to it', async () => {
    const fetchMock = installIndexFetchMock()
    const user = userEvent.setup()
    renderPanel()
    await screen.findByRole('heading', { name: officialIndex.name })

    expect(requestedUrls(fetchMock)).not.toContain(GITHUB_MARKETPLACE_INDEX_URL)

    await user.click(sourceMenu())
    await user.click(screen.getByRole('menuitemradio', { name: 'GitHub' }))

    expect(
      await screen.findByRole('heading', { name: githubIndex.name })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: officialIndex.name })
    ).toBeNull()
    expect(sourceMenu()).toHaveTextContent('GitHub')
    expect(requestedUrls(fetchMock)).toContain(GITHUB_MARKETPLACE_INDEX_URL)
  })

  test('does not request GitHub automatically when the official source fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEFAULT_MARKETPLACE_INDEX_URL) {
        return new Response('', { status: 503 })
      }
      return new Response(JSON.stringify(githubIndex), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel()

    expect(
      await screen.findByText('Could not load this source')
    ).toBeInTheDocument()
    expect(requestedUrls(fetchMock)).toContain(DEFAULT_MARKETPLACE_INDEX_URL)
    expect(requestedUrls(fetchMock)).not.toContain(GITHUB_MARKETPLACE_INDEX_URL)
  })

  test('revalidates the index instead of reusing a stale browser-cached copy', async () => {
    const staleIndex: MarketplaceIndex = { ...officialIndex, name: 'Stale' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const revalidated = ['no-cache', 'no-store', 'reload'].includes(
          init?.cache ?? 'default'
        )
        return new Response(
          JSON.stringify(revalidated ? officialIndex : staleIndex),
          { status: 200 }
        )
      })
    )
    renderPanel()

    expect(
      await screen.findByRole('heading', { name: officialIndex.name })
    ).toBeInTheDocument()
  })
})

const communitySource: MarketplaceSource = {
  name: 'Community',
  index_url: COMMUNITY_MARKETPLACE_INDEX_URL,
}

function communityPlugin(key: string, recommended = false) {
  return {
    key,
    name: key,
    latest: '1.0.0',
    recommended,
    versions: [{ version: '1.0.0', path: `files/${'a'.repeat(64)}` }],
  }
}

describe('MarketplacePanel community plugins', () => {
  test('lists community and third-party sources under Community plugins with the warning', async () => {
    const mirror = {
      name: 'Mirror',
      index_url: 'https://mirror.example/i.json',
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const index =
        String(input) === COMMUNITY_MARKETPLACE_INDEX_URL
          ? {
              indexVersion: 1,
              name: 'Community catalog',
              plugins: [
                communityPlugin('bob_bar'),
                communityPlugin('alice_foo', true),
              ],
            }
          : officialIndex
      return new Response(JSON.stringify(index), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderPanel([officialSource, communitySource, mirror])
    await screen.findByRole('heading', { name: officialIndex.name })
    expect(
      screen.queryByText(/Community plugins come from their authors/)
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Community plugins' }))

    expect(
      await screen.findByRole('heading', { name: 'Recommended' })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'More plugins' })).toBeVisible()
    expect(
      screen.getByText(
        'Community plugins are published and maintained by their authors. Check the source before you install.'
      )
    ).toBeVisible()
    expect(await menuChoices(user)).toEqual([
      'Main site (www.newapi.ai)',
      'Backup site (www.newapi.pro)',
      'Mirror',
    ])
    expect(screen.getByLabelText('Plugin code')).toHaveAttribute(
      'placeholder',
      '12345678'
    )
    expect(requestedUrls(fetchMock)).toContain(COMMUNITY_MARKETPLACE_INDEX_URL)
  })

  test('the official list shows its recommended plugins in their own group', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ...officialIndex,
          plugins: [communityPlugin('sora'), communityPlugin('incho', true)],
        })
      )
    )
    renderPanel([officialSource])

    expect(
      await screen.findByRole('heading', { name: 'Recommended' })
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'More plugins' })).toBeVisible()
  })

  test('a list added by the administrator cannot mark plugins recommended', async () => {
    const mirror = {
      name: 'Mirror',
      index_url: 'https://mirror.example/i.json',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        Response.json(
          String(input) === mirror.index_url
            ? {
                indexVersion: 1,
                name: 'Mirror catalog',
                plugins: [
                  communityPlugin('bob_bar'),
                  communityPlugin('eve_ad', true),
                ],
              }
            : officialIndex
        )
      )
    )
    const user = userEvent.setup()
    renderPanel([officialSource, mirror])
    await screen.findByRole('heading', { name: officialIndex.name })

    await user.click(screen.getByRole('button', { name: 'Community plugins' }))

    await screen.findByRole('heading', { name: 'Mirror catalog' })
    expect(screen.getByRole('button', { name: 'Card eve_ad' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Recommended' })).toBeNull()
  })

  test('official tab: the code lookup shares the top row with the market switch; the list header has only the source menu and Refresh', async () => {
    installIndexFetchMock()
    const user = userEvent.setup()
    renderPanel()

    const list = await screen.findByRole('region', {
      name: officialIndex.name,
    })
    expect(
      within(list)
        .getAllByRole('button')
        .map(
          (button) => button.getAttribute('aria-label') ?? button.textContent
        )
    ).toEqual(['Plugin download site', 'Refresh'])
    expect(await menuChoices(user)).toEqual([
      'Main site (www.newapi.ai)',
      'Backup site (www.newapi.pro)',
      'GitHub',
    ])

    const topRow = screen
      .getByLabelText('Plugin code')
      .closest('form')?.parentElement
    expect(topRow).toContainElement(
      screen.getByRole('button', { name: 'Official plugins' })
    )
    expect(topRow).not.toContainElement(list)
  })

  test('Manage sources opens from the source menu', async () => {
    installIndexFetchMock()
    const user = userEvent.setup()
    renderPanel()
    await screen.findByRole('heading', { name: officialIndex.name })

    await user.click(sourceMenu())
    await user.click(screen.getByRole('menuitem', { name: 'Manage sources' }))

    expect(await screen.findByText('Sources dialog open')).toBeVisible()
  })

  test('community tab puts the warning in the list header and keeps the code lookup on top, sized for 8 digits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const index =
          String(input) === COMMUNITY_MARKETPLACE_INDEX_URL
            ? {
                indexVersion: 1,
                name: 'Community catalog',
                plugins: [communityPlugin('alice_foo')],
              }
            : officialIndex
        return new Response(JSON.stringify(index), { status: 200 })
      })
    )
    const user = userEvent.setup()
    renderPanel([officialSource, communitySource])
    await screen.findByRole('heading', { name: officialIndex.name })

    await user.click(screen.getByRole('button', { name: 'Community plugins' }))

    const list = await screen.findByRole('region', {
      name: 'Community catalog',
    })
    expect(
      within(list).getByText(
        'Community plugins are published and maintained by their authors. Check the source before you install.'
      )
    ).toBeVisible()
    const input = screen.getByLabelText('Plugin code')
    expect(list).not.toContainElement(input)
    expect(input).toHaveClass('w-36')
  })

  test('names the community address when the source list has none', async () => {
    installIndexFetchMock()
    const user = userEvent.setup()
    renderPanel()
    await screen.findByRole('heading', { name: officialIndex.name })
    await user.click(screen.getByRole('button', { name: 'Community plugins' }))
    expect(
      screen.getByText('Add this address in Manage sources:')
    ).toBeVisible()
    expect(screen.getByText(COMMUNITY_MARKETPLACE_INDEX_URL)).toBeVisible()
    // Official plugin codes can still be looked up.
    expect(screen.getByLabelText('Plugin code')).toBeVisible()
  })

  test('a pasted plugin code opens the install dialog for the community source', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/resolve')) {
        if (url.searchParams.get('code') !== '40817265') {
          return new Response('', { status: 404 })
        }
        return new Response(
          JSON.stringify({
            indexVersion: 1,
            plugins: [communityPlugin('alice_foo')],
          }),
          { status: 200 }
        )
      }
      return new Response(JSON.stringify({ indexVersion: 1, plugins: [] }), {
        status: 200,
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderPanel([communitySource])
    const input = await screen.findByLabelText('Plugin code')

    // Only 8 digits can be looked up; the old owner/repo form is not a code.
    await user.type(input, 'alice/newapi-plugins/foo')
    expect(screen.getByRole('button', { name: 'Find' })).toBeDisabled()

    await user.clear(input)
    await user.type(input, '12345678')
    await user.click(screen.getByRole('button', { name: 'Find' }))
    expect(await screen.findByText('No plugin has this code.')).toBeVisible()

    await user.clear(input)
    await user.type(input, ' 40817265 ')
    await user.click(screen.getByRole('button', { name: 'Find' }))
    // Find shows the plugin; installing starts from its card.
    expect(
      await screen.findByText('Result for plugin code 40817265')
    ).toBeVisible()
    expect(screen.queryByText(/^Installing/)).toBeNull()
    const result = screen
      .getByText('Result for plugin code 40817265')
      .closest('section') as HTMLElement
    await user.click(
      within(result).getByRole('button', { name: 'Card alice_foo' })
    )
    expect(
      await screen.findByText('Installing alice_foo from Community')
    ).toBeVisible()
    await user.click(within(result).getByRole('button', { name: 'Clear' }))
    expect(screen.queryByText('Result for plugin code 40817265')).toBeNull()
    expect(requestedUrls(fetchMock)).toContain(
      'https://www.newapi.ai/api/v1/community/resolve?code=40817265'
    )
  })

  test('an official plugin code opens the install dialog for the official source', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEFAULT_MARKETPLACE_INDEX_URL) {
        return new Response(
          JSON.stringify({
            indexVersion: 1,
            name: officialIndex.name,
            plugins: [
              {
                key: 'sora',
                name: 'Sora',
                latest: '1.0.0',
                code: '10000001',
                versions: [{ version: '1.0.0', path: 'sora/1.0.0/plugin.js' }],
              },
            ],
          }),
          { status: 200 }
        )
      }
      if (new URL(url).pathname.endsWith('/resolve')) {
        return new Response('', { status: 404 })
      }
      return new Response(JSON.stringify({ indexVersion: 1, plugins: [] }), {
        status: 200,
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderPanel([officialSource, communitySource])
    const input = await screen.findByLabelText('Plugin code')

    await user.type(input, '10000001')
    await user.click(screen.getByRole('button', { name: 'Find' }))
    const result = (
      await screen.findByText('Result for plugin code 10000001')
    ).closest('section') as HTMLElement
    expect(within(result).getByText('Official')).toBeVisible()
    await user.click(within(result).getByRole('button', { name: 'Card sora' }))
    expect(
      await screen.findByText('Installing sora from Official')
    ).toBeVisible()
    expect(
      requestedUrls(fetchMock).some((url) => url.includes('/resolve'))
    ).toBe(false)

    // Not an official code: the community site is asked next.
    await user.clear(input)
    await user.type(input, '12345679')
    await user.click(screen.getByRole('button', { name: 'Find' }))
    expect(await screen.findByText('No plugin has this code.')).toBeVisible()
    expect(requestedUrls(fetchMock)).toContain(
      'https://www.newapi.ai/api/v1/community/resolve?code=12345679'
    )
  })
})

describe('MarketplacePanel download site', () => {
  test('picking the backup site reloads the list from www.newapi.pro', async () => {
    const fetchMock = installIndexFetchMock()
    renderPanel([officialSource])
    expect(
      await screen.findByRole('heading', { name: officialIndex.name })
    ).toBeInTheDocument()
    expect(requestedUrls(fetchMock)).toEqual([DEFAULT_MARKETPLACE_INDEX_URL])

    await userEvent.click(sourceMenu())
    await userEvent.click(
      screen.getByRole('menuitemradio', {
        name: 'Backup site (www.newapi.pro)',
      })
    )

    await waitFor(() =>
      expect(requestedUrls(fetchMock)).toContain(
        'https://www.newapi.pro/api/v1/plugins/index.json'
      )
    )
    expect(sourceMenu()).toHaveTextContent('Backup site (www.newapi.pro)')
    expect(usePluginSiteStore.getState().site).toBe('pro')
  })

  test('from the backup site the main site can be picked again', async () => {
    usePluginSiteStore.setState({ site: 'pro' })
    const fetchMock = installIndexFetchMock()
    renderPanel([officialSource])
    expect(
      await screen.findByRole('heading', { name: officialIndex.name })
    ).toBeInTheDocument()
    expect(requestedUrls(fetchMock)).toEqual([
      'https://www.newapi.pro/api/v1/plugins/index.json',
    ])

    await userEvent.click(sourceMenu())
    await userEvent.click(
      screen.getByRole('menuitemradio', { name: 'Main site (www.newapi.ai)' })
    )

    await waitFor(() =>
      expect(requestedUrls(fetchMock)).toContain(DEFAULT_MARKETPLACE_INDEX_URL)
    )
    expect(sourceMenu()).toHaveTextContent('Main site (www.newapi.ai)')
    expect(usePluginSiteStore.getState().site).toBe('ai')
  })
})
