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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UsageStats } from '../index'

const DAY = 24 * 3600

const getUsageStat = vi.fn()

vi.mock('../api', () => ({
  getUsageStat: (params: { start_timestamp: number; end_timestamp: number }) =>
    getUsageStat(params),
}))

vi.mock('../components/cache-hit-rate-chart', () => ({
  CacheHitRateChart: () => <div data-testid='chart' />,
}))

vi.mock('../components/usage-stat-table', () => ({
  UsageStatTable: () => <div data-testid='table' />,
}))

// Stubbed so the test can drive the range without opening the popover.
vi.mock(
  '@/features/usage-logs/components/compact-date-time-range-picker',
  () => ({
    CompactDateTimeRangePicker: (props: {
      start?: Date
      end?: Date
      onChange: (range: { start?: Date; end?: Date }) => void
    }) => (
      <button
        type='button'
        data-testid='pick-custom'
        onClick={() => {
          const end = props.end ?? new Date()
          props.onChange({
            start: new Date(end.getTime() - 3 * 24 * 3600 * 1000),
            end,
          })
        }}
      />
    ),
  })
)

function workspace() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <UsageStats />
    </QueryClientProvider>
  )
}

/** Span of the window handed to the API by the most recent call, in seconds. */
function lastWindowSpan() {
  const params = getUsageStat.mock.calls.at(-1)?.[0] as {
    start_timestamp: number
    end_timestamp: number
  }
  return params.end_timestamp - params.start_timestamp
}

/** Full window handed to the API by the most recent call. */
function lastWindowParams() {
  return getUsageStat.mock.calls.at(-1)?.[0] as {
    start_timestamp: number
    end_timestamp: number
  }
}

describe('usage stats window controls', () => {
  beforeEach(() => {
    getUsageStat.mockResolvedValue({
      data: { by_model: [], by_channel: [], totals: { count: 0 } },
    })
  })

  it('opens on a rolling 24 hour window', async () => {
    workspace()
    await waitFor(() => expect(getUsageStat).toHaveBeenCalledTimes(1))
    expect(lastWindowSpan()).toBe(DAY)
  })

  it('refetches the same window when refresh is pressed', async () => {
    workspace()
    await waitFor(() => expect(getUsageStat).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(getUsageStat).toHaveBeenCalledTimes(2))
    expect(lastWindowSpan()).toBe(DAY)
  })

  it('keeps a hand-picked window on refresh and restores the default on reset', async () => {
    workspace()
    await waitFor(() => expect(getUsageStat).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByTestId('pick-custom'))
    await waitFor(() => expect(getUsageStat).toHaveBeenCalledTimes(2))
    expect(lastWindowSpan()).toBe(3 * DAY)

    // Refresh must not silently widen a range the user chose.
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(getUsageStat).toHaveBeenCalledTimes(3))
    expect(lastWindowSpan()).toBe(3 * DAY)

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(getUsageStat).toHaveBeenCalledTimes(4))
    expect(lastWindowSpan()).toBe(DAY)
  })

  it('re-anchors the rolling window to the latest moment when reset is pressed', async () => {
    workspace()
    await waitFor(() => expect(getUsageStat).toHaveBeenCalledTimes(1))
    const before = lastWindowParams()
    expect(before.end_timestamp - before.start_timestamp).toBe(DAY)

    // A few minutes pass on the page, then the user asks for "now" again.
    vi.useFakeTimers()
    try {
      vi.setSystemTime((before.end_timestamp + 5 * 60) * 1000)
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
      await act(async () => {})

      const after = lastWindowParams()
      expect(getUsageStat).toHaveBeenCalledTimes(2)
      expect(after.end_timestamp - after.start_timestamp).toBe(DAY)
      expect(after.end_timestamp - before.end_timestamp).toBe(5 * 60)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stamps the moment the numbers were fetched', async () => {
    workspace()
    await waitFor(() =>
      expect(
        screen.getByText(/^Updated \d{2}:\d{2}:\d{2}$/)
      ).toBeInTheDocument()
    )
  })
})
