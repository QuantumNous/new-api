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
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { useState } from 'react'
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest'

import type { UserChartsFilters } from '@/features/dashboard/types'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'

import { UserCharts } from '../user-charts'

// VChart renders through the browser canvas, which jsdom cannot provide.
vi.mock('@visactor/react-vchart', () => ({
  VChart: ({
    spec,
  }: {
    spec: { title: { text: string }; data: { values: unknown[] }[] }
  }) => (
    <output aria-label={spec.title.text}>
      {JSON.stringify(spec.data[0].values)}
    </output>
  ),
}))
vi.mock('@visactor/vchart', () => ({
  ThemeManager: { setCurrentTheme: () => {} },
}))

const originalAnimations = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'getAnimations'
)
beforeAll(() =>
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
)
afterAll(() => {
  if (originalAnimations) {
    Object.defineProperty(
      Element.prototype,
      'getAnimations',
      originalAnimations
    )
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations')
  }
})

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

afterEach(async () => {
  cleanup()
  client.clear()
  vi.useRealTimers()
  await i18next.changeLanguage('en')
  window.localStorage.clear()
})

function Dashboard(props: { initialFilters?: Partial<UserChartsFilters> }) {
  const [visible, setVisible] = useState(true)
  const [filters, setFilters] = useState<UserChartsFilters>({
    metric: 'quota',
    timeGranularity: 'hour',
    selectedRange: 1,
    topUserLimit: 10,
    ...props.initialFilters,
  })
  return (
    <QueryClientProvider client={client}>
      <button type='button' onClick={() => setVisible(!visible)}>
        Toggle users
      </button>
      {visible && <UserCharts filters={filters} onFiltersChange={setFilters} />}
    </QueryClientProvider>
  )
}

test('metric tabs support clicks and keyboard selection and survive section switches', async () => {
  // Keep the network pending: this interaction does not need a canvas renderer.
  vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}))
  const user = userEvent.setup()
  render(<Dashboard />)
  const tabs = within(screen.getByRole('tablist', { name: 'Usage metric' }))
  expect(tabs.getByRole('tab', { name: 'By quota' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await user.click(tabs.getByRole('tab', { name: 'By tokens' }))
  expect(tabs.getByRole('tab', { name: 'By tokens' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await user.keyboard('{ArrowRight}{Enter}')
  expect(tabs.getByRole('tab', { name: 'By requests' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await user.click(screen.getByRole('button', { name: 'Toggle users' }))
  await user.click(screen.getByRole('button', { name: 'Toggle users' }))
  expect(screen.getByRole('tab', { name: 'By requests' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
})

const usage = [
  {
    user_id: 1,
    username: 'alex_a',
    display_name: 'Alex',
    created_at: 1794009600,
    quota: 0,
    token_used: 100,
    count: 2,
  },
  {
    user_id: 2,
    username: 'alex_b',
    display_name: 'Alex',
    created_at: 1794009600,
    quota: 500000,
    token_used: 200,
    count: 3,
  },
]

test('searching a display name selects distinct accounts and filters both charts before ranking', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: usage },
  })
  const user = userEvent.setup()
  render(<Dashboard initialFilters={{ metric: 'tokens', topUserLimit: 5 }} />)
  const input = screen.getByRole('combobox', {
    name: 'Search display names or usernames',
  })
  await waitFor(() => expect(input).toBeEnabled())
  await user.type(input, 'Alex')
  expect(
    screen.getByRole('option', { name: 'Alex (alex_b)' })
  ).toBeInTheDocument()
  await user.click(screen.getByRole('option', { name: 'Alex (alex_a)' }))
  await user.tab()
  for (const name of ['User Usage Ranking', 'User Usage Trend']) {
    const chart = screen.getByLabelText(name)
    expect(chart).toHaveTextContent('user:1')
    expect(chart).not.toHaveTextContent('user:2')
    expect(chart).toHaveTextContent('100')
  }
  await user.click(screen.getByRole('tab', { name: 'By requests' }))
  await user.click(screen.getByRole('button', { name: 'Toggle users' }))
  await user.click(screen.getByRole('button', { name: 'Toggle users' }))
  expect(screen.getByText('Alex (alex_a)')).toBeInTheDocument()
  expect(screen.getByLabelText('User Usage Ranking')).toHaveTextContent(
    '"value":2'
  )
  await user.click(
    screen.getByRole('combobox', { name: 'Search display names or usernames' })
  )
  await user.keyboard('{Backspace}{Escape}')
  expect(screen.getByLabelText('User Usage Ranking')).toHaveTextContent(
    'user:2'
  )
})

test('custom dates apply exact local timestamps and survive granularity and section changes', async () => {
  const request = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true, data: usage } })
  const user = userEvent.setup()
  const start = new Date(2026, 10, 1, 0, 0, 0)
  const end = new Date(2026, 10, 7, 23, 59, 59)
  render(<Dashboard initialFilters={{ customRange: { start, end } }} />)
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  fireEvent.change(
    within(screen.getByRole('group', { name: 'Start Time' })).getByLabelText(
      'Time'
    ),
    {
      target: { value: '08:30:45' },
    }
  )
  await user.click(screen.getByRole('button', { name: 'Apply Filters' }))
  const expected = {
    start_timestamp: new Date(2026, 10, 1, 8, 30, 45).getTime() / 1000,
    end_timestamp: end.getTime() / 1000,
  }
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith('/api/data/users', {
      params: expected,
    })
  )
  expect(
    screen.getByRole('status', { name: 'Custom Time Range' })
  ).toHaveTextContent('2026-11-01 08:30:45')
  await user.click(screen.getByRole('tab', { name: 'Day' }))
  await user.click(screen.getByRole('button', { name: 'Toggle users' }))
  await user.click(screen.getByRole('button', { name: 'Toggle users' }))
  expect(
    screen.getByRole('status', { name: 'Custom Time Range' })
  ).toHaveTextContent('2026-11-07 23:59:59')
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  expect(
    within(screen.getByRole('group', { name: 'Start Time' })).getByLabelText(
      'Time'
    )
  ).toHaveValue('08:30:45')
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('tab', { name: '7 Days' }))
  expect(screen.queryByText(/^Custom Time Range:/)).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '7 Days' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
})

test('missing or reversed custom dates cannot be applied and cancel keeps the previous range', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: usage },
  })
  const user = userEvent.setup()
  render(
    <Dashboard
      initialFilters={{
        customRange: {
          start: new Date(2026, 10, 1, 8),
          end: new Date(2026, 10, 1, 9),
        },
      }}
    />
  )
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  const start = within(screen.getByRole('group', { name: 'Start Time' }))
  fireEvent.change(start.getByLabelText('Time'), {
    target: { value: '10:00:00' },
  })
  expect(screen.getByRole('button', { name: 'Apply Filters' })).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent('Choose both dates')
  await user.click(start.getByRole('button', { name: 'Clear' }))
  expect(screen.getByRole('button', { name: 'Apply Filters' })).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(
    screen.getByRole('status', { name: 'Custom Time Range' })
  ).toHaveTextContent('2026-11-01 08:00:00')
})

test('a selected account with no usage stays selected with its name, and reset restores all users', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: [] } })
  const user = userEvent.setup()
  render(
    <Dashboard
      initialFilters={{
        selectedUsers: [{ value: 'user:1', label: 'Alex (alex_a)' }],
      }}
    />
  )
  expect(screen.getByText('Alex (alex_a)')).toBeInTheDocument()
  expect(await screen.findByLabelText('User Usage Ranking')).toHaveTextContent(
    '[]'
  )
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  await user.click(screen.getByRole('button', { name: 'Reset' }))
  expect(screen.queryByText('Alex (alex_a)')).not.toBeInTheDocument()
  expect(
    screen.getByRole('combobox', { name: 'Search display names or usernames' })
  ).toHaveValue('')
})

test('Chinese locale translates the metric selector and both chart headings', async () => {
  vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}))
  i18next.addResourceBundle('zh', 'translation', zh.translation)
  await i18next.changeLanguage('zh')
  render(<Dashboard />)
  expect(screen.getByRole('tablist', { name: '统计指标' })).toBeInTheDocument()
  expect(screen.getByText('用户用量排名')).toBeInTheDocument()
  expect(screen.getByText('用户用量趋势')).toBeInTheDocument()
})

test('rolling presets query the current window every minute and stop when leaving the section', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date('2026-11-09T00:00:00Z'))
  const request = vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: usage },
  })
  render(
    <Dashboard initialFilters={{ selectedRange: 7, metric: 'requests' }} />
  )
  await waitFor(() =>
    expect(screen.getByLabelText('User Usage Ranking')).toHaveTextContent(
      '"value":3'
    )
  )
  request.mockResolvedValue({
    data: { success: true, data: [{ ...usage[0], count: 9 }] },
  })
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith('/api/data/users', {
      params: {
        start_timestamp: Date.parse('2026-11-02T00:01:00Z') / 1000,
        end_timestamp: Date.parse('2026-11-09T00:01:00Z') / 1000,
      },
    })
  )
  for (const name of ['User Usage Ranking', 'User Usage Trend']) {
    expect(screen.getByLabelText(name)).toHaveTextContent('"value":9')
  }
  fireEvent.click(screen.getByRole('button', { name: 'Toggle users' }))
  request.mockClear()
  await act(() => vi.advanceTimersByTimeAsync(120_000))
  expect(request).not.toHaveBeenCalled()
})

test('applying a quick range keeps its preset selected and advances after returning to the section', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-09T00:00:00Z'))
  const request = vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: usage },
  })
  const user = userEvent.setup()
  render(<Dashboard />)
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  await user.click(screen.getByRole('button', { name: '7 Days' }))
  await user.click(screen.getByRole('button', { name: 'Apply Filters' }))
  expect(screen.getByRole('tab', { name: '7 Days' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(
    screen.queryByRole('status', { name: 'Custom Time Range' })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Toggle users' }))
  vi.setSystemTime(new Date('2026-11-09T01:00:00Z'))
  await user.click(screen.getByRole('button', { name: 'Toggle users' }))
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith('/api/data/users', {
      params: {
        start_timestamp: Date.parse('2026-11-02T01:00:00Z') / 1000,
        end_timestamp: Date.parse('2026-11-09T01:00:00Z') / 1000,
      },
    })
  )
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  expect(
    within(screen.getByRole('group', { name: 'End Time' })).getByLabelText(
      'Time'
    )
  ).toHaveValue(new Date('2026-11-09T01:00:00Z').toTimeString().slice(0, 8))
})

test('an exact seven-day custom range stays fixed through dialog apply, elapsed time and section changes', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date('2026-11-09T00:00:00Z'))
  const request = vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: usage },
  })
  const user = userEvent.setup()
  render(
    <Dashboard
      initialFilters={{
        customRange: {
          start: new Date('2026-11-01T00:00:00Z'),
          end: new Date('2026-11-08T00:00:00Z'),
        },
      }}
    />
  )
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  expect(screen.getByRole('button', { name: '7 Days' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
  await user.click(screen.getByRole('button', { name: 'Apply Filters' }))
  await waitFor(() =>
    expect(screen.getByLabelText('User Usage Ranking')).toHaveTextContent(
      'user:1'
    )
  )
  request.mockClear()
  await act(() => vi.advanceTimersByTimeAsync(120_000))
  expect(request).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Toggle users' }))
  await user.click(screen.getByRole('button', { name: 'Toggle users' }))
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith('/api/data/users', {
      params: {
        start_timestamp: Date.parse('2026-11-01T00:00:00Z') / 1000,
        end_timestamp: Date.parse('2026-11-08T00:00:00Z') / 1000,
      },
    })
  )
  expect(
    screen.getByRole('status', { name: 'Custom Time Range' })
  ).toBeInTheDocument()
})

test('editing a quick range creates fixed dates without polling overwriting the draft', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date(2026, 10, 9, 10, 0, 0))
  const request = vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: usage },
  })
  const user = userEvent.setup()
  render(<Dashboard />)
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  await user.click(screen.getByRole('button', { name: '7 Days' }))
  const endInput = within(
    screen.getByRole('group', { name: 'End Time' })
  ).getByLabelText('Time')
  fireEvent.change(endInput, { target: { value: '09:30:00' } })
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  expect(endInput).toHaveValue('09:30:00')
  expect(screen.getByRole('button', { name: '7 Days' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
  await user.click(screen.getByRole('button', { name: 'Apply Filters' }))
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith('/api/data/users', {
      params: {
        start_timestamp: new Date(2026, 10, 2, 10, 0, 0).getTime() / 1000,
        end_timestamp: new Date(2026, 10, 9, 9, 30, 0).getTime() / 1000,
      },
    })
  )
  expect(
    screen.getByRole('status', { name: 'Custom Time Range' })
  ).toHaveTextContent('2026-11-09 09:30:00')
  request.mockClear()
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  expect(request).not.toHaveBeenCalled()
})
