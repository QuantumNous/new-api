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
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, expect, test, vi } from 'vitest'

import { PluginReadmeSection } from '../components/plugin-readme-section'
import type { MarketplaceIndexVersion, MarketplacePlugin } from '../types'

const sourceUrl = 'https://github.com/alice/demo/blob/abc/README.md'
const listed: MarketplaceIndexVersion = {
  version: '1.0.0',
  path: 'files/plugin',
  readme: { path: 'files/readme', sourceUrl },
}
const guide = `# Demo

Pick the **Demo** channel type. See [setup](docs/setup.md).
`
const clients: QueryClient[] = []

function renderSection(version: MarketplaceIndexVersion = listed) {
  const plugin: MarketplacePlugin = {
    key: 'demo',
    name: 'Demo',
    latest: '1.0.0',
    versions: [version],
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <PluginReadmeSection
        indexUrl='https://example.com/index.json'
        plugin={plugin}
        version='1.0.0'
      />
    </QueryClientProvider>
  )
}

afterEach(async () => {
  clients.forEach((client) => client.clear())
  clients.length = 0
  vi.unstubAllGlobals()
  await act(() => i18next.changeLanguage('en'))
})

test('renders the guide and resolves relative links against its page', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(guide))
  )
  renderSection()
  const section = await screen.findByRole('region', { name: 'Usage guide' })
  expect(within(section).getByRole('heading', { name: 'Demo' })).toBeVisible()
  expect(
    within(section).getByText('Demo', { selector: 'strong' })
  ).toBeVisible()
  expect(within(section).getByRole('link', { name: 'setup' })).toHaveAttribute(
    'href',
    'https://github.com/alice/demo/blob/abc/docs/setup.md'
  )
})

test('a reader without a translation sees English with a notice', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(guide))
  )
  await act(() => i18next.changeLanguage('zhCN'))
  renderSection()
  expect(
    await screen.findByText(
      'This usage guide is not available in your language. Showing English.'
    )
  ).toBeVisible()
})

test('a version the index lists no guide for shows a quiet line and downloads nothing', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  renderSection({ version: '1.0.0', path: 'files/plugin' })
  expect(screen.getByText('No usage guide for this version.')).toBeVisible()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a guide that returns 404 shows the quiet line without retry', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 404 }))
  )
  renderSection()
  expect(
    await screen.findByText('No usage guide for this version.')
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Retry' })
  ).not.toBeInTheDocument()
})

test('a failed download shows an inline error that retries', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response(guide))
  )
  renderSection()
  expect(
    await screen.findByText('Could not load the usage guide')
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('heading', { name: 'Demo' })).toBeVisible()
})

test('a guide with HTML is not rendered and the note names the line with a source link', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(guide.replace('Pick the', '<img src=x> Pick the'))
    )
  )
  renderSection()
  expect(
    await screen.findByText(
      'Could not show the usage guide. README.md line 3: HTML is not allowed',
      { exact: false }
    )
  ).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'View source file' })
  ).toHaveAttribute('href', sourceUrl)
  expect(
    screen.queryByRole('heading', { name: 'Demo' })
  ).not.toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Retry' })
  ).not.toBeInTheDocument()
})
