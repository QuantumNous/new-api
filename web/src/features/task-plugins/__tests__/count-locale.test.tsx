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
import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PluginCard } from '../components/plugin-card'
import { PluginMetadataCard } from '../components/plugin-metadata-card'
import { PluginModelList } from '../components/plugin-model-list'
import type { TaskPluginListItem, TaskPluginMeta } from '../types'

// Icon rendering is outside these count checks (see plugin-card.test.tsx).
vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))

const models = Array.from({ length: 12 }, (_, index) => `model-${index}`)

const meta: TaskPluginMeta = {
  apiVersion: 1,
  key: 'kling',
  name: 'Kling',
  version: '1.2.3',
  author: { name: 'acme' },
  models,
  fetchMode: 'proxy',
  sortPriority: 10,
}

const item: TaskPluginListItem = {
  meta,
  source: 'factory',
  enabled: true,
  active: true,
  source_hash: '',
  remark: '',
  runtime_status: 'registered',
  channel_count: 0,
  in_flight_count: 0,
}

const columns: ColumnDef<TaskPluginListItem, unknown>[] = []

function PluginCardHarness() {
  const table = useReactTable({
    data: [item],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  return <PluginCard row={table.getRowModel().rows[0]} />
}

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('task plugin counts', () => {
  it('in English, keeps the model count, priority and hidden model count', async () => {
    await i18next.changeLanguage('en')
    render(<PluginMetadataCard meta={meta} />)

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('in Persian, writes the model count and priority with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    render(<PluginMetadataCard meta={meta} />)

    expect(screen.getByText('۱۲')).toBeInTheDocument()
    expect(screen.getByText('۱۰')).toBeInTheDocument()
  })

  it('in Persian, writes the collapsed model count with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    render(<PluginModelList models={models} maxVisible={9} />)

    expect(screen.getByText(/\(۳\)/)).toBeInTheDocument()
  })

  it('in Persian, writes the hidden model badge on a plugin card with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    render(<PluginCardHarness />)

    expect(screen.getByText(/^\+[۰-۹]+$/)).toBeInTheDocument()
  })
})
