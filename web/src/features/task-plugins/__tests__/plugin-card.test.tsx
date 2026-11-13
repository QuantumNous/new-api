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
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { MarketplacePluginCard } from '../components/marketplace-plugin-card'
import { PluginCard } from '../components/plugin-card'
import type { PluginKind } from '../lib/plugin-kinds'
import type { TaskPluginListItem } from '../types'

// @lobehub/icons transitively imports @emoji-mart JSON assets that vitest's
// externalized ESM loader rejects. Icon rendering is irrelevant to the card
// layout contracts under test, so the icon loader boundary is stubbed.
vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
}))

function makeItem(overrides?: Partial<TaskPluginListItem>): TaskPluginListItem {
  return {
    meta: {
      apiVersion: 1,
      key: 'kling',
      name: 'Kling',
      version: '1.2.3',
      author: { name: 'acme' },
      models: ['kling-v1', 'kling-v2'],
      fetchMode: 'proxy',
      description: { en: 'Generate videos with Kling.' },
      usageSchema: {
        duration: { type: 'number', unit: 'second' },
      },
    },
    source: 'factory',
    enabled: true,
    active: true,
    source_hash: '',
    remark: '',
    runtime_status: 'registered',
    channel_count: 0,
    in_flight_count: 0,
    ...overrides,
  }
}

const stubColumns: ColumnDef<TaskPluginListItem, unknown>[] = [
  { id: 'source', cell: () => 'source-badge' },
  { id: 'runtime', cell: () => 'runtime-badge' },
  { id: 'enabled', cell: () => 'enabled-switch' },
  { id: 'actions', cell: () => 'actions-menu' },
]

function PluginCardHarness({
  item,
  kind = 'task',
}: {
  item: TaskPluginListItem
  kind?: PluginKind
}) {
  const table = useReactTable({
    data: [item],
    columns: stubColumns,
    getCoreRowModel: getCoreRowModel(),
  })
  return <PluginCard row={table.getRowModel().rows[0]} kind={kind} />
}

describe('PluginCard layout', () => {
  test('given a plugin, the plugin version reads as a pill beside the source and runtime badges', () => {
    render(<PluginCardHarness item={makeItem()} />)

    const version = screen.getByText('v1.2.3')
    const badgeRow = version.parentElement
    expect(screen.queryByText('API v1')).not.toBeInTheDocument()
    expect(badgeRow).toHaveClass('flex-wrap')
    expect(badgeRow?.textContent).toContain('source-badge')
    expect(badgeRow?.textContent).toContain('runtime-badge')
  })

  test('given a plugin, the plugin version carries a labelled accessible name', () => {
    render(<PluginCardHarness item={makeItem()} />)

    expect(screen.getByLabelText('Active version 1.2.3')).toBeInTheDocument()
  })

  test('given a description, it is clamped to two lines', () => {
    render(<PluginCardHarness item={makeItem()} />)

    expect(screen.getByText('Generate videos with Kling.')).toHaveClass(
      'line-clamp-2'
    )
  })

  test('given a plugin, the bound models render as named chips rather than a count', () => {
    render(<PluginCardHarness item={makeItem()} />)

    expect(screen.getByText('Models')).toBeInTheDocument()
    expect(screen.getByText('kling-v1')).toBeInTheDocument()
    expect(screen.getByText('kling-v2')).toBeInTheDocument()
  })

  test('given more than four models, only four chips render plus an overflow count', () => {
    render(
      <PluginCardHarness
        item={makeItem({
          meta: {
            ...makeItem().meta,
            models: ['a', 'b', 'c', 'd', 'e', 'f'],
          },
        })}
      />
    )

    for (const model of ['a', 'b', 'c', 'd']) {
      expect(screen.getByText(model)).toBeInTheDocument()
    }
    expect(screen.queryByText('e')).toBeNull()
    expect(screen.queryByText('f')).toBeNull()
    expect(screen.getByText('+2')).toHaveAttribute('title', 'e, f')
  })

  test('given no models, the models section is omitted', () => {
    render(
      <PluginCardHarness
        item={makeItem({ meta: { ...makeItem().meta, models: [] } })}
      />
    )

    expect(screen.queryByText('Models')).toBeNull()
  })

  test('given a usage schema, billing parameters stay out of the card', () => {
    const { container } = render(<PluginCardHarness item={makeItem()} />)

    expect(screen.queryByText('Billing parameters')).toBeNull()
    expect(screen.queryByText('duration')).toBeNull()
    expect(container.querySelector('table')).toBeNull()
  })

  test('given a plugin, the footer pins the enabled toggle at the card bottom', () => {
    render(<PluginCardHarness item={makeItem()} />)

    const label = screen.getByText('Enabled')
    const footer = label.parentElement
    expect(footer).toHaveClass('mt-auto')
    expect(screen.getByText('enabled-switch')).toBeInTheDocument()
  })
})

describe('PluginCard website', () => {
  test('shows an HTTPS website with safe new-tab attributes', () => {
    const item = makeItem()
    item.meta.website = 'https://example.com/docs'
    render(<PluginCardHarness item={item} />)
    const link = screen.getByRole('link', { name: 'Plugin website' })
    expect(link).toHaveAttribute('href', item.meta.website)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
  test.each([undefined, 'http://example.com', 'javascript:alert(1)'])(
    'hides website %s',
    (website) => {
      const item = makeItem()
      item.meta.website = website
      render(<PluginCardHarness item={item} />)
      expect(
        screen.queryByRole('link', { name: 'Plugin website' })
      ).not.toBeInTheDocument()
    }
  )
})

test.each(['override', 'factory', 'override_over_factory'] as const)(
  'marketplace entry for %s offers installation',
  async (source) => {
    const user = userEvent.setup()
    const onInstall = vi.fn()
    render(
      <MarketplacePluginCard
        kind='task'
        plugin={{
          key: 'kling',
          name: 'Kling',
          latest: '1.2.3',
          versions: [{ version: '1.2.3', path: 'plugin.js' }],
        }}
        installed={makeItem({ source })}
        installState={{ status: 'up_to_date', installedVersion: '1.2.3' }}
        onInstall={onInstall}
      />
    )
    expect(
      screen.queryByRole('button', { name: 'Select version' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Install' }))
    expect(onInstall).toHaveBeenCalledOnce()
    expect(
      screen.queryByText('Updates with the system')
    ).not.toBeInTheDocument()
  }
)

describe('PluginCard part tags', () => {
  test('given a provider plugin with login, the badge row carries the Channel and Account login tags', () => {
    render(
      <PluginCardHarness
        item={makeItem({ task: false, provider: true, login: true })}
      />
    )

    const badgeRow = screen.getByText('v1.2.3').parentElement
    expect(badgeRow?.textContent).toContain('Channel')
    expect(badgeRow?.textContent).toContain('Account login')
  })

  test('given a request processing plugin, the badge row carries the Request processing tag', () => {
    render(
      <PluginCardHarness
        item={makeItem({ task: false, provider: false, transform: true })}
      />
    )

    const badgeRow = screen.getByText('v1.2.3').parentElement
    expect(badgeRow?.textContent).toContain('Request processing')
    expect(badgeRow?.textContent).not.toContain('Channel')
  })

  test('given a task-only plugin, no part tags render', () => {
    render(
      <PluginCardHarness
        item={makeItem({ task: true, provider: false, login: false })}
      />
    )

    expect(screen.queryByText('Channel')).toBeNull()
    expect(screen.queryByText('Account login')).toBeNull()
    expect(screen.queryByText('Request processing')).toBeNull()
  })

  test('given an older server and a manifest with relay routes, the Channel tag still renders', () => {
    render(
      <PluginCardHarness
        item={makeItem({
          meta: {
            ...makeItem().meta,
            relay: [
              { incoming_path: '/v1/chat/completions', upstream_path: '/chat' },
            ],
          },
        })}
      />
    )

    expect(screen.getByText('Channel')).toBeInTheDocument()
    expect(screen.queryByText('Account login')).toBeNull()
  })
})

describe('PluginCard in a kind list', () => {
  test('given the provider list, a task and provider plugin shows the Task tag but not the Channel tag', () => {
    render(
      <PluginCardHarness
        item={makeItem({ task: true, provider: true, login: true })}
        kind='provider'
      />
    )

    const badgeRow = screen.getByText('v1.2.3').parentElement
    expect(badgeRow?.textContent).toContain('Task')
    expect(badgeRow?.textContent).toContain('Account login')
    expect(badgeRow?.textContent).not.toContain('Channel')
  })

  test('given the request processing list, the card names its stages instead of its models', () => {
    render(
      <PluginCardHarness
        item={makeItem({
          task: true,
          transform: true,
          transform_hooks: ['ingress', 'egress', 'report'],
        })}
        kind='transform'
      />
    )

    expect(screen.getByText('When it runs')).toBeInTheDocument()
    expect(screen.getByText('Before the request is read')).toBeInTheDocument()
    expect(screen.getByText('Final check')).toBeInTheDocument()
    expect(screen.getByText('After the request')).toBeInTheDocument()
    expect(screen.queryByText('Models')).toBeNull()
    expect(screen.queryByText('kling-v1')).toBeNull()
    expect(screen.getByText('v1.2.3').parentElement?.textContent).not.toContain(
      'Request processing'
    )
  })
})

describe('MarketplacePluginCard part tags', () => {
  test('given an index entry with relay routes, the card shows the Channel tag and the plugin channel type', () => {
    render(
      <MarketplacePluginCard
        kind='task'
        plugin={{
          key: 'acme',
          name: 'Acme',
          latest: '1.0.0',
          versions: [{ version: '1.0.0', path: 'plugin.js' }],
          relay: [
            { incoming_path: '/v1/chat/completions', upstream_path: '/chat' },
          ],
        }}
        installState={{ status: 'not_installed' }}
        onInstall={() => undefined}
      />
    )

    expect(screen.getByText('Channel')).toBeInTheDocument()
    expect(screen.getByText('Plugin')).toBeInTheDocument()
    expect(screen.queryByText('Task Plugin')).toBeNull()
  })

  test('given an index entry without relay routes, the card has no Provider tag', () => {
    render(
      <MarketplacePluginCard
        kind='task'
        plugin={{
          key: 'acme',
          name: 'Acme',
          latest: '1.0.0',
          versions: [{ version: '1.0.0', path: 'plugin.js' }],
        }}
        installState={{ status: 'not_installed' }}
        onInstall={() => undefined}
      />
    )

    expect(screen.queryByText('Channel')).toBeNull()
    expect(screen.getByText('Task Plugin')).toBeInTheDocument()
  })
})
