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
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { useStatus } from '@/hooks/use-status'
import { api } from '@/lib/api'
import {
  STATUS_QUERY_KEY,
  STATUS_STORAGE_KEY,
  ensureStatus,
  statusQueryOptions,
} from '@/lib/status-query'

/**
 * Guards the deduplication contract of the shared `['status']` query: several
 * independent consumers asking for status must cost one `/api/status` request.
 */

type ApiMethod = (url: string) => Promise<{ data: unknown }>
type MockableApi = { get: ApiMethod }

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get

let statusRequests: string[] = []

/** Count `/api/status` calls at the network boundary and serve `system_name`. */
function stubStatusEndpoint(systemName: string): void {
  apiClient.get = async (url) => {
    if (url !== '/api/status') throw new Error(`Unexpected GET ${url}`)
    statusRequests.push(url)
    return { data: { success: true, data: { system_name: systemName } } }
  }
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function wrapper(queryClient: QueryClient) {
  return function QueryWrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    )
  }
}

beforeEach(() => {
  statusRequests = []
  window.localStorage.removeItem(STATUS_STORAGE_KEY)
})

afterEach(() => {
  apiClient.get = originalGet
  window.localStorage.removeItem(STATUS_STORAGE_KEY)
})

describe('shared status query deduplication', () => {
  test('serves concurrent guard and hook consumers from one /api/status request', async () => {
    stubStatusEndpoint('shared')
    const queryClient = createQueryClient()

    const guards = Promise.all([
      ensureStatus(queryClient),
      ensureStatus(queryClient),
      ensureStatus(queryClient),
    ])
    const hook = renderHook(() => useStatus(), {
      wrapper: wrapper(queryClient),
    })

    const guardResults = await guards
    await waitFor(() => {
      expect(hook.result.current.status?.system_name).toBe('shared')
    })

    expect(guardResults.map((status) => status?.system_name)).toEqual([
      'shared',
      'shared',
      'shared',
    ])
    expect(statusRequests).toHaveLength(1)
  })

  test('resolves a later consumer from the warm cache without a second request', async () => {
    stubStatusEndpoint('warm')
    const queryClient = createQueryClient()

    await ensureStatus(queryClient)
    const second = await ensureStatus(queryClient)

    expect(second?.system_name).toBe('warm')
    expect(statusRequests).toHaveLength(1)
  })

  test('returns a stale entry immediately and refreshes it in the background', async () => {
    stubStatusEndpoint('refreshed')
    const queryClient = createQueryClient()
    const staleTime = statusQueryOptions.staleTime as number
    queryClient.setQueryData(
      STATUS_QUERY_KEY,
      { system_name: 'stale' },
      {
        updatedAt: Date.now() - staleTime - 1,
      }
    )

    const resolved = await ensureStatus(queryClient)

    expect(resolved?.system_name).toBe('stale')
    await waitFor(() => {
      expect(
        queryClient.getQueryData<Record<string, unknown>>(STATUS_QUERY_KEY)
          ?.system_name
      ).toBe('refreshed')
    })
    expect(statusRequests).toHaveLength(1)
  })
})
