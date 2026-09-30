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
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { ModelDetailsCacheStats } from '../components/model-details-cache-stats'
import type { PricingModel } from '../types'

// The component tree pulls in the performance tab's chart helpers; mock the
// vchart packages so the test only exercises the cache stats behavior.
vi.mock('@visactor/react-vchart', () => ({
  VChart: () => <div data-testid='vchart-mock' />,
}))
vi.mock('@visactor/vchart', () => ({
  ThemeManager: { setCurrentTheme: vi.fn() },
}))

function pricingModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'example-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 3,
    enable_groups: ['default'],
    group_ratio: { default: 1 },
    ...overrides,
  }
}

function renderStats() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ModelDetailsCacheStats model={pricingModel()} />
    </QueryClientProvider>
  )
  return queryClient
}

function mockCacheStats(data: Record<string, unknown> | null) {
  return vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true, data } } as never)
}

describe('model details cache stats', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
    localStorage.clear()
  })

  test('renders the read/creation/hit rate cards from the window stats', async () => {
    mockCacheStats({
      model_name: 'example-model',
      count: 10,
      prompt_tokens: 100,
      cache_tokens: 40,
      cache_creation_tokens: 5,
      cache_hit_count: 6,
    })
    const queryClient = renderStats()

    expect(await screen.findByText('Cache rate (last 24h)')).toBeVisible()
    expect(
      screen.getByText('Cache rates of 10 requests in the last 24 hours')
    ).toBeVisible()
    expect(screen.getByText('Cache Read Rate')).toBeVisible()
    expect(screen.getByText('40.0%')).toBeVisible()
    expect(screen.getByText('Cache Creation Rate')).toBeVisible()
    expect(screen.getByText('5.0%')).toBeVisible()
    expect(screen.getByText('Cache Hit Rate')).toBeVisible()
    expect(screen.getByText('60.0%')).toBeVisible()
    queryClient.clear()
  })

  test('hides the section when the cache rate statistics feature is off', async () => {
    useSystemConfigStore
      .getState()
      .setConfig({ cacheRateStatsEnabled: false })
    const get = mockCacheStats(null)
    const queryClient = renderStats()

    await waitFor(() => expect(get).not.toHaveBeenCalled())
    expect(
      screen.queryByText('Cache rate (last 24h)')
    ).not.toBeInTheDocument()
    queryClient.clear()
  })

  test('hides the section when the model has no usage in the window', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            model_name: 'example-model',
            count: 10,
            prompt_tokens: 100,
            cache_tokens: 40,
            cache_creation_tokens: 5,
            cache_hit_count: 6,
          },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            model_name: 'example-model',
            count: 0,
            prompt_tokens: 0,
            cache_tokens: 0,
            cache_creation_tokens: 0,
            cache_hit_count: 0,
          },
        },
      } as never)
    const queryClient = renderStats()

    // Commit a positive render first so the removal assertion below can only
    // pass on a real zero-count update.
    expect(await screen.findByText('Cache rate (last 24h)')).toBeVisible()
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ['model-cache-stats', 'example-model'],
      })
    })
    await waitFor(() =>
      expect(
        screen.queryByText('Cache rate (last 24h)')
      ).not.toBeInTheDocument()
    )
    expect(get).toHaveBeenCalledTimes(2)
    queryClient.clear()
  })
})
