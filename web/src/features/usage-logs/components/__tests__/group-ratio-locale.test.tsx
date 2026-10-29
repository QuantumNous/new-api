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
vi.mock('../usage-logs-provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../usage-logs-provider')>()),
  useUsageLogsContext: () => ({ sensitiveVisible: true }),
}))
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
  // Without a model price or ratio, the details cell shows the group ratio.
  other: JSON.stringify({ group_ratio: 1.5 }),
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
    .filter((cell) => ['token_name', 'content'].includes(cell.column.id))
    .map((cell) => (
      <div key={cell.id} data-testid={cell.column.id}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    ))
}

async function renderLogCells(lng: 'en' | 'fa'): Promise<void> {
  const i18n: I18n = createInstance()
  await i18n.init({
    lng,
    fallbackLng: 'en',
    resources: { en, fa: { translation: { Cost: 'هزینه' } } },
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

describe('usage log group ratio', () => {
  it('in English, keeps the group ratio in the token and details cells as before', async () => {
    await renderLogCells('en')
    expect(screen.getByTestId('token_name')).toHaveTextContent('1.5x')
    expect(screen.getByTestId('content')).toHaveTextContent('Group Ratio 1.5x')
  })

  it('in Persian, writes the group ratio in the token and details cells with Persian digits', async () => {
    await renderLogCells('fa')
    expect(screen.getByTestId('token_name')).toHaveTextContent('۱٫۵x')
    expect(screen.getByTestId('content')).toHaveTextContent('Group Ratio ۱٫۵x')
  })
})
