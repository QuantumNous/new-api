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
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import type { UserChartsFilters } from '@/features/dashboard/types'
import { api } from '@/lib/api'

import { UserCharts } from '../user-charts'

type ChartProps = {
  spec: { data: { values: { User: string }[] }[] }
}

const chart = vi.hoisted(() => vi.fn((_props: ChartProps) => null))
vi.mock('@visactor/react-vchart', () => ({ VChart: chart }))
vi.mock('@visactor/vchart', () => ({
  ThemeManager: { setCurrentTheme: vi.fn() },
}))
vi.mock('@/context/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

const now = Math.floor(Date.now() / 1000)
const rows = [
  { username: 'p_2ff8ed3c', display_name: 'Alice', created_at: now, quota: 2 },
  { username: 'svc_10bf2464', display_name: '', created_at: now, quota: 1 },
]

let client: QueryClient
beforeEach(() => {
  chart.mockClear()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: rows },
  })
})
afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

function Fixture() {
  const [filters, setFilters] = useState<UserChartsFilters>({
    timeGranularity: 'day',
    selectedRange: 7,
    topUserLimit: 10,
    userLabel: 'username',
  })
  return <UserCharts filters={filters} onFiltersChange={setFilters} />
}

// Rank and trend charts render one VChart each; read the labels both use.
function lastChartLabels() {
  return chart.mock.calls
    .slice(-2)
    .map(([props]) => [
      ...new Set(props.spec.data[0].values.map((row) => row.User)),
    ])
}

it('switches both user charts to display names', async () => {
  render(
    <QueryClientProvider client={client}>
      <Fixture />
    </QueryClientProvider>
  )

  await waitFor(() =>
    expect(lastChartLabels()).toEqual([
      ['p_2ff8ed3c', 'svc_10bf2464'],
      ['p_2ff8ed3c', 'svc_10bf2464'],
    ])
  )

  const option = screen.getByRole('tab', { name: 'Display Name' })
  await userEvent.click(option)

  expect(option).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'Username' })).toHaveAttribute(
    'aria-selected',
    'false'
  )
  await waitFor(() =>
    expect(lastChartLabels()).toEqual([
      ['Alice', 'svc_10bf2464'],
      ['Alice', 'svc_10bf2464'],
    ])
  )
})
