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
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cleanup, render, screen } from '@testing-library/react'
import { createInstance, type i18n as I18n } from 'i18next'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import en from '@/i18n/locales/en.json'

import type { UsageLog } from '../../data/schema'
import { useCommonLogsColumns } from '../columns/common-logs-columns'

vi.mock('@lobehub/icons', () => ({}))
vi.hoisted(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
})
afterAll(() => vi.unstubAllGlobals())

afterEach(() => {
  cleanup()
})

// Persian currency amounts from Intl start with a left-to-right mark.
const LRM = '‎'

const log: UsageLog = {
  id: 1,
  user_id: 1,
  created_at: 1,
  type: 2,
  content: '',
  username: 'user',
  token_name: 'token',
  model_name: 'gpt-4o',
  quota: 5000,
  prompt_tokens: 0,
  completion_tokens: 0,
  use_time: 0,
  is_stream: false,
  channel: 1,
  channel_name: '',
  token_id: 1,
  group: 'default',
  ip: '',
  other: JSON.stringify({ model_price: 0.25 }),
  request_id: 'req-1',
  upstream_request_id: '',
}

function LogCells(): ReactNode {
  const table = useReactTable({
    data: [log],
    columns: useCommonLogsColumns(true, false),
    getCoreRowModel: getCoreRowModel(),
  })
  return table
    .getRowModel()
    .rows[0].getAllCells()
    .filter((cell) => ['quota', 'content'].includes(cell.column.id))
    .map((cell) => (
      <div key={cell.id}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    ))
}

// Persian is requested; whether it resolves depends on whether Persian
// translations are loaded, as in the app.
async function renderLogCells(persianLoaded: boolean): Promise<void> {
  const i18n: I18n = createInstance()
  await i18n.init({
    lng: 'fa',
    fallbackLng: 'en',
    resources: persianLoaded
      ? { en, fa: { translation: { Cost: 'هزینه' } } }
      : { en },
    interpolation: { escapeValue: false },
  })
  const client = new QueryClient()
  client.setQueryData(['status'], {}, { updatedAt: Date.now() + 60_000 })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <LogCells />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

describe('usage log details cell locale', () => {
  it('when the interface language resolves to English, writes the details price like the cost cell', async () => {
    await renderLogCells(false)

    expect(screen.getByText('$0.01')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Per-call · $0.25' })
    ).toBeInTheDocument()
  })

  it('when the interface language resolves to Persian, writes the details price with Persian digits like the cost cell', async () => {
    await renderLogCells(true)

    expect(screen.getByText(`${LRM}$۰٫۰۱`)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `Per-call · ${LRM}$۰٫۲۵` })
    ).toBeInTheDocument()
  })
})
