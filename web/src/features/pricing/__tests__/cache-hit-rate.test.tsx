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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { formatCacheHitRate } from '@/features/performance-metrics/lib/format'
import { api } from '@/lib/api'

import { ModelDetailsContent } from '../components/model-details'

vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
})

afterEach(() => client.clear())

it.each([
  [95, '95%'],
  [95.375, '95.38%'],
  [0, '0%'],
  [null, '—'],
] as const)(
  'shows the same cache rate %s in four metrics in both model tabs',
  async (rate, display) => {
    const request = vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          model_name: 'cache-test-model',
          cache_hit_rate: rate,
          summary: {
            avg_tps: 63.4,
            avg_latency_ms: 26680,
            success_rate: 93.75,
          },
          groups: [],
          series: [],
        },
      },
    })
    render(
      <QueryClientProvider client={client}>
        <ModelDetailsContent
          model={{
            id: 1,
            model_name: 'cache-test-model',
            quota_type: 0,
            model_ratio: 1,
            completion_ratio: 1,
            enable_groups: [],
          }}
          groupRatio={{}}
          usableGroup={{}}
          endpointMap={{}}
          autoGroups={[]}
          priceRate={1}
          usdExchangeRate={1}
          tokenUnit='M'
        />
      </QueryClientProvider>
    )
    const overview = await screen.findByRole('group', { name: 'Performance' })
    expect(await within(overview).findByText('63.4 t/s')).toBeVisible()
    expect(within(overview).getByText('Cache hit rate')).toBeVisible()
    expect(within(overview).getByText(display)).toBeVisible()
    expect(overview).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-4')

    await userEvent.click(screen.getByRole('tab', { name: 'Performance' }))
    const performance = screen.getByRole('group', { name: 'Performance' })
    expect(within(performance).getByText(display)).toBeVisible()
    for (const label of [
      'TPS',
      'Average latency',
      'Success rate',
      'Cache hit rate',
    ]) {
      expect(within(performance).getByText(label)).toBeVisible()
    }
    expect(performance).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-4'
    )
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('/api/perf-metrics', {
      params: { model: 'cache-test-model', hours: 24 },
    })
  }
)

it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY, -1, 101])(
  'shows an unavailable rate for invalid or missing value %s',
  (value) => expect(formatCacheHitRate(value)).toBe('—')
)
