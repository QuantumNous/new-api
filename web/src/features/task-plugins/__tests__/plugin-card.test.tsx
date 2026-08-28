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
import { describe, expect, test, vi } from 'vitest'

import { PluginCard } from '../components/plugin-card'
import type { TaskPluginListItem } from '../types'

// @lobehub/icons transitively imports @emoji-mart JSON assets that vitest's
// externalized ESM loader rejects. Icon rendering is irrelevant to the card
// layout contracts under test, so the icon loader boundary is stubbed.
vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
}))

function makeItem(
  overrides?: Partial<TaskPluginListItem>
): TaskPluginListItem {
  return {
    meta: {
      apiVersion: 1,
      key: 'kling',
      name: 'Kling',
      version: '1.2.3',
      author: { name: 'acme' },
      models: ['kling-v1', 'kling-v2'],
      fetchMode: 'proxy',
      actions: null,
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

function PluginCardHarness({ item }: { item: TaskPluginListItem }) {
  const table = useReactTable({
    data: [item],
    columns: stubColumns,
    getCoreRowModel: getCoreRowModel(),
  })
  return <PluginCard row={table.getRowModel().rows[0]} />
}

describe('PluginCard layout', () => {
  test('given a plugin, the scalar fields share one wrapping inline stats row', () => {
    render(<PluginCardHarness item={makeItem()} />)

    const versionStat = screen.getByText('Active version').parentElement
    const modelsStat = screen.getByText('Models').parentElement
    expect(versionStat).not.toBeNull()
    expect(versionStat?.parentElement).toBe(modelsStat?.parentElement)
    expect(versionStat?.parentElement).toHaveClass('flex-wrap')
  })

  test('given a plugin, the API version renders with the v prefix like the table view', () => {
    render(<PluginCardHarness item={makeItem()} />)

    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('1.2.3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  test('given a description, it is clamped to two lines', () => {
    render(<PluginCardHarness item={makeItem()} />)

    expect(screen.getByText('Generate videos with Kling.')).toHaveClass(
      'line-clamp-2'
    )
  })

  test('given a usage schema, billing parameters render as the compact list without a table', () => {
    const { container } = render(<PluginCardHarness item={makeItem()} />)

    expect(screen.getByText('Billing parameters')).toBeInTheDocument()
    expect(screen.getByText('duration')).toBeInTheDocument()
    expect(container.querySelector('table')).toBeNull()
  })

  test('given no usage schema, the billing parameters section is omitted', () => {
    const item = makeItem()
    delete item.meta.usageSchema
    render(<PluginCardHarness item={item} />)

    expect(screen.queryByText('Billing parameters')).toBeNull()
  })

  test('given a plugin, the footer pins the enabled toggle at the card bottom', () => {
    render(<PluginCardHarness item={makeItem()} />)

    const label = screen.getByText('Enabled')
    const footer = label.parentElement
    expect(footer).toHaveClass('mt-auto')
    expect(screen.getByText('enabled-switch')).toBeInTheDocument()
  })
})
