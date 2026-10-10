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
import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'

import type { UsageLog } from '../../data/schema'
import { DetailsDialog } from '../dialogs/details-dialog'

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
  other: JSON.stringify({
    model_ratio: 1,
    completion_ratio: 1,
    group_ratio: 1.5,
    web_search: true,
    web_search_call_count: 3,
    file_search: true,
    file_search_call_count: 2,
  }),
  request_id: 'req-1',
  upstream_request_id: '',
}

function renderDetails(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const freshAt = Date.now() + 60_000
  client.setQueryData(['status'], {}, { updatedAt: freshAt })
  client.setQueryData(
    ['pricing'],
    { data: [], vendors: [] },
    { updatedAt: freshAt }
  )
  render(
    <QueryClientProvider client={client}>
      <DetailsDialog
        log={log}
        isAdmin={false}
        isRoot={false}
        open
        onOpenChange={() => undefined}
      />
    </QueryClientProvider>
  )
}

function rowValue(label: string): string | null {
  return screen.getByText(label).nextElementSibling?.textContent ?? null
}

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('log details billing breakdown', () => {
  it('in English, keeps the group ratio and the search call counts as before', async () => {
    await i18next.changeLanguage('en')
    renderDetails()
    expect(rowValue('Group Ratio')).toBe('1.5000x')
    expect(rowValue('Web Search')).toBe('3x')
    expect(rowValue('File Search')).toBe('2x')
  })

  it('in Persian, writes the group ratio and the search call counts with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    renderDetails()
    expect(rowValue('Group Ratio')).toBe('۱٫۵۰۰۰x')
    expect(rowValue('Web Search')).toBe('۳x')
    expect(rowValue('File Search')).toBe('۲x')
  })
})
