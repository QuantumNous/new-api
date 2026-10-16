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
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import type { UsageLog } from '../../data/schema'
import type { LogOtherData } from '../../types'
import { DetailsDialog } from '../dialogs/details-dialog'

const queryClients: QueryClient[] = []

function makeConsumeLog(other: LogOtherData): UsageLog {
  return {
    id: 1,
    user_id: 1,
    created_at: 1,
    type: 2,
    content: 'Batch inference billing',
    username: 'user',
    token_name: 'batch-key',
    model_name: 'gpt-test',
    quota: 1800,
    prompt_tokens: 1000,
    completion_tokens: 200,
    use_time: 0,
    is_stream: false,
    channel: 0,
    channel_name: '',
    token_id: 1,
    group: 'batch',
    ip: '',
    other: JSON.stringify(other),
    request_id: 'req-1',
    upstream_request_id: '',
  }
}

function renderDetails(other: LogOtherData): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(['status'], {}, { updatedAt: Date.now() + 60_000 })
  queryClients.push(queryClient)

  render(
    <QueryClientProvider client={queryClient}>
      <DetailsDialog
        log={makeConsumeLog(other)}
        isAdmin={false}
        isRoot={false}
        open
        onOpenChange={() => undefined}
      />
    </QueryClientProvider>
  )
}

afterEach(() => {
  for (const queryClient of queryClients) {
    queryClient.clear()
  }
  queryClients.length = 0
})

describe('usage log batch billing details', () => {
  test('marks a batch platform charge and shows its batch request id', () => {
    renderDetails({
      batch_billing: true,
      batch_request_id: 'job-42',
      batch_billing_mode: 'usage',
    })

    expect(screen.getByText('Batch inference')).toBeInTheDocument()
    expect(screen.getByText('Batch Request ID')).toBeInTheDocument()
    expect(screen.getByText('job-42')).toBeInTheDocument()
  })

  test('leaves ordinary consume logs unmarked', () => {
    renderDetails({ billing_source: 'wallet' })

    expect(screen.queryByText('Batch inference')).toBeNull()
    expect(screen.queryByText('Batch Request ID')).toBeNull()
  })
})
