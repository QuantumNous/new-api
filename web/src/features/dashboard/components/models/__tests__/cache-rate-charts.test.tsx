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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { CacheRateCharts } from '../cache-rate-charts'

type CapturedChartSpec = {
  data?: Array<{ values?: Array<{ Series: string }> }>
}

const chartSpecs = vi.hoisted((): CapturedChartSpec[] => [])

vi.mock('@visactor/react-vchart', () => ({
  VChart: (vchartProps: { spec: CapturedChartSpec }) => {
    chartSpecs.push(vchartProps.spec)
    return <div data-testid='vchart-mock' />
  },
}))
vi.mock('@visactor/vchart', () => ({
  ThemeManager: { setCurrentTheme: vi.fn() },
}))

const modelData = [
  {
    model_name: 'gpt-test',
    created_at: 1767225600,
    count: 1,
    quota: 10,
    token_used: 100,
    prompt_tokens: 100,
    cache_tokens: 60,
    cache_creation_tokens: 5,
  },
]

function renderCharts(props: {
  data?: typeof modelData
  loading?: boolean
  filters?: { username?: string }
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <CacheRateCharts
        filters={{
          time_granularity: 'hour',
          ...(props.filters?.username
            ? { username: props.filters.username }
            : {}),
        }}
        data={props.data ?? modelData}
        loading={props.loading}
        timeGranularity='hour'
      />
    </QueryClientProvider>
  )
  return queryClient
}

describe('cache rate charts', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    chartSpecs.length = 0
    useAuthStore.setState(useAuthStore.getInitialState(), true)
    useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
    localStorage.clear()
  })

  test('renders the panel with metric toggles and the model dimension for regular users', async () => {
    renderCharts()
    expect(screen.getByText('Cache Rate Analytics')).toBeVisible()
    expect(screen.getByRole('tab', { name: 'By model' })).toBeVisible()
    expect(
      screen.getByRole('tab', { name: 'By group' })
    ).toBeVisible()
    expect(
      screen.queryByRole('tab', { name: 'By channel' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'By user' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Cache Read Rate' })
    ).toBeVisible()
    expect(
      screen.getByRole('tab', { name: 'Cache Creation Rate' })
    ).toBeVisible()
    await waitFor(() => {
      expect(screen.getByTestId('vchart-mock')).toBeInTheDocument()
    })
  })

  test('shows the channel dimension only for admins and loads channel data on switch', async () => {
    const user = userEvent.setup()
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({
        data: {
          success: true,
          data: [
            {
              channel_id: 7,
              channel_name: 'primary',
              created_at: 1767225600,
              prompt_tokens: 100,
              cache_tokens: 40,
              cache_creation_tokens: 0,
            },
          ],
        },
      } as never)
    renderCharts()

    const channelTab = screen.getByRole('tab', { name: 'By channel' })
    expect(channelTab).toBeVisible()
    await user.click(channelTab)

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(
        '/api/data/channel',
        expect.objectContaining({
          params: expect.objectContaining({}),
        })
      )
    })
    await waitFor(() => {
      expect(screen.getByTestId('vchart-mock')).toBeInTheDocument()
    })
  })

  test('renders the empty state when no rows carry prompt tokens', () => {
    renderCharts({ data: [] })
    expect(screen.getByText('No cache data available')).toBeVisible()
    expect(screen.queryByTestId('vchart-mock')).not.toBeInTheDocument()
  })

  test('passes the dashboard username filter to the channel request', async () => {
    const user = userEvent.setup()
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { success: true, data: [] } } as never)
    renderCharts({ filters: { username: 'alice' } })

    await user.click(screen.getByRole('tab', { name: 'By channel' }))

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(
        '/api/data/channel',
        expect.objectContaining({
          params: expect.objectContaining({ username: 'alice' }),
        })
      )
    })
  })

  test('keeps same-named channels as distinct chart series', async () => {
    const user = userEvent.setup()
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            channel_id: 7,
            channel_name: 'primary',
            created_at: 1767225600,
            prompt_tokens: 100,
            cache_tokens: 40,
            cache_creation_tokens: 0,
          },
          {
            channel_id: 8,
            channel_name: 'primary',
            created_at: 1767225600,
            prompt_tokens: 50,
            cache_tokens: 10,
            cache_creation_tokens: 0,
          },
        ],
      },
    } as never)
    renderCharts()

    await user.click(screen.getByRole('tab', { name: 'By channel' }))

    await waitFor(() => {
      expect(screen.getByTestId('vchart-mock')).toBeInTheDocument()
    })
    const seriesNames = new Set(
      (chartSpecs.at(-1)?.data?.[0]?.values ?? []).map(
        (value) => value.Series
      )
    )
    expect(seriesNames.has('primary')).toBe(true)
    expect(seriesNames.has('primary (#8)')).toBe(true)
    expect(seriesNames.size).toBe(2)
  })

  test('keeps one channel in a single series across time buckets', async () => {
    const user = userEvent.setup()
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    // Two channels share the name 'primary', each with two hourly buckets:
    // every bucket of channel 7 must stay in the plain 'primary' series
    // instead of being split into suffixed variants.
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: [1, 8]
          .flatMap((channelId) =>
            [1767225600, 1767229200].map((createdAt) => ({
              channel_id: channelId,
              channel_name: 'primary',
              created_at: createdAt,
              prompt_tokens: 100,
              cache_tokens: 40,
              cache_creation_tokens: 0,
            }))
          ),
      },
    } as never)
    renderCharts()

    await user.click(screen.getByRole('tab', { name: 'By channel' }))

    await waitFor(() => {
      expect(screen.getByTestId('vchart-mock')).toBeInTheDocument()
    })
    const values = chartSpecs.at(-1)?.data?.[0]?.values ?? []
    const bucketsBySeries = new Map<string, number>()
    for (const value of values) {
      bucketsBySeries.set(
        value.Series,
        (bucketsBySeries.get(value.Series) ?? 0) + 1
      )
    }
    expect(bucketsBySeries.get('primary')).toBe(2)
    expect(bucketsBySeries.get('primary (#8)')).toBe(2)
    expect(bucketsBySeries.size).toBe(2)
  })

  test('renders an error state instead of empty data when the channel request fails', async () => {
    const user = userEvent.setup()
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    vi.spyOn(api, 'get').mockRejectedValue(new Error('network down'))
    renderCharts()

    await user.click(screen.getByRole('tab', { name: 'By channel' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to load cache analytics')).toBeVisible()
    })
    expect(screen.queryByTestId('vchart-mock')).not.toBeInTheDocument()
    expect(
      screen.queryByText('No cache data available')
    ).not.toBeInTheDocument()
  })

  test('loads own-group data on the group dimension for regular users', async () => {
    const user = userEvent.setup()
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({
        data: {
          success: true,
          data: [
            {
              use_group: 'vip',
              created_at: 1767225600,
              count: 2,
              prompt_tokens: 100,
              cache_tokens: 40,
              cache_creation_tokens: 0,
              cache_hit_count: 1,
            },
          ],
        },
      } as never)
    renderCharts()

    await user.click(screen.getByRole('tab', { name: 'By group' }))

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(
        '/api/data/group/self',
        expect.objectContaining({
          params: expect.not.objectContaining({ username: expect.anything() }),
        })
      )
    })
    await waitFor(() => {
      expect(screen.getByTestId('vchart-mock')).toBeInTheDocument()
    })
    const seriesNames = new Set(
      (chartSpecs.at(-1)?.data?.[0]?.values ?? []).map(
        (value) => value.Series
      )
    )
    expect(seriesNames.has('vip')).toBe(true)
  })

  test('loads all-users group data with the username filter for admins', async () => {
    const user = userEvent.setup()
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({
        data: {
          success: true,
          data: [
            {
              use_group: 'vip',
              created_at: 1767225600,
              count: 1,
              prompt_tokens: 80,
              cache_tokens: 60,
              cache_creation_tokens: 5,
              cache_hit_count: 1,
            },
            {
              use_group: '',
              created_at: 1767225600,
              count: 1,
              prompt_tokens: 40,
              cache_tokens: 0,
              cache_creation_tokens: 0,
              cache_hit_count: 0,
            },
          ],
        },
      } as never)
    renderCharts({ filters: { username: 'alice' } })

    expect(screen.getByRole('tab', { name: 'By user' })).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'By group' }))

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(
        '/api/data/group',
        expect.objectContaining({
          params: expect.objectContaining({ username: 'alice' }),
        })
      )
    })
    await waitFor(() => {
      expect(screen.getByTestId('vchart-mock')).toBeInTheDocument()
    })
    const seriesNames = new Set(
      (chartSpecs.at(-1)?.data?.[0]?.values ?? []).map(
        (value) => value.Series
      )
    )
    expect(seriesNames.has('vip')).toBe(true)
    expect(seriesNames.has('Unknown')).toBe(true)
  })

  test('loads per-user data on the user dimension for admins', async () => {
    const user = userEvent.setup()
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({
        data: {
          success: true,
          data: [
            {
              username: 'alice',
              created_at: 1767225600,
              count: 1,
              prompt_tokens: 100,
              cache_tokens: 40,
              cache_creation_tokens: 0,
              cache_hit_count: 1,
            },
            {
              username: 'bob',
              created_at: 1767225600,
              count: 2,
              prompt_tokens: 50,
              cache_tokens: 0,
              cache_creation_tokens: 10,
              cache_hit_count: 0,
            },
          ],
        },
      } as never)
    renderCharts({ filters: { username: 'alice' } })

    await user.click(screen.getByRole('tab', { name: 'By user' }))

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(
        '/api/data/users',
        expect.objectContaining({
          params: expect.objectContaining({ username: 'alice' }),
        })
      )
    })
    await waitFor(() => {
      expect(screen.getByTestId('vchart-mock')).toBeInTheDocument()
    })
    const seriesNames = new Set(
      (chartSpecs.at(-1)?.data?.[0]?.values ?? []).map(
        (value) => value.Series
      )
    )
    expect(seriesNames.has('alice')).toBe(true)
    expect(seriesNames.has('bob')).toBe(true)
  })

  test('renders an error state when the group request fails', async () => {
    const user = userEvent.setup()
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'tester', role: ROLE.ADMIN })
    vi.spyOn(api, 'get').mockRejectedValue(new Error('network down'))
    renderCharts()

    await user.click(screen.getByRole('tab', { name: 'By group' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to load cache analytics')).toBeVisible()
    })
    expect(screen.queryByTestId('vchart-mock')).not.toBeInTheDocument()
    expect(
      screen.queryByText('No cache data available')
    ).not.toBeInTheDocument()
  })
})
