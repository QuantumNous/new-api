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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { DEFAULT_DASHBOARD_CHART_PREFERENCES } from '@/features/dashboard/constants'
import type { DashboardFilters } from '@/features/dashboard/types'
import { useAuthStore } from '@/stores/auth-store'

import { ModelsFilter } from '../models-filter-dialog'

const now = new Date(2026, 9, 8, 15, 30)
const onChange = vi.fn()
const originalGetAnimations = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'getAnimations'
)

function FilterHarness(props: { filters?: DashboardFilters }) {
  const [filters, setFilters] = useState<DashboardFilters>(
    props.filters ?? {
      start_timestamp: new Date(now.getTime() - 86400000),
      end_timestamp: now,
      time_granularity: 'hour',
      username: 'alice',
    }
  )
  return (
    <ModelsFilter
      preferences={DEFAULT_DASHBOARD_CHART_PREFERENCES}
      currentFilters={filters}
      onFilterChange={(value) => {
        setFilters(value)
        onChange(value)
      }}
      onReset={vi.fn()}
    />
  )
}

beforeEach(() => {
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  onChange.mockClear()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  if (originalGetAnimations) {
    Object.defineProperty(
      Element.prototype,
      'getAnimations',
      originalGetAnimations
    )
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations')
  }
  useAuthStore.setState(useAuthStore.getInitialState(), true)
})

test.each([
  ['Today', new Date(2026, 9, 8), 'hour'],
  ['24 hours', new Date(now.getTime() - 86400000), 'hour'],
  ['Last 7 days', new Date(now.getTime() - 7 * 86400000), 'day'],
] as const)(
  'main-page %s shortcut applies the range immediately and preserves the username',
  async (label, start, granularity) => {
    const user = userEvent.setup()
    render(<FilterHarness filters={{ username: 'alice' }} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: label }))
    expect(onChange).toHaveBeenLastCalledWith({
      username: 'alice',
      start_timestamp: start,
      end_timestamp: now,
      time_granularity: granularity,
    })
    expect(screen.getByRole('button', { name: label })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  }
)

test('custom ranges do not highlight a shortcut and keyboard selection applies today', async () => {
  const user = userEvent.setup()
  render(
    <FilterHarness
      filters={{
        start_timestamp: new Date(2026, 9, 7, 20),
        end_timestamp: now,
      }}
    />
  )
  for (const label of ['Today', '24 hours', 'Last 7 days']) {
    expect(screen.getByRole('button', { name: label })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  }
  screen.getByRole('button', { name: 'Today' }).focus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})

test('opening and applying advanced filters preserves the shortcut range', async () => {
  const user = userEvent.setup()
  render(<FilterHarness />)
  expect(screen.getByRole('button', { name: '24 hours' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await user.click(screen.getByRole('button', { name: 'Today' }))
  await user.click(screen.getByRole('button', { name: /^Filter$/ }))
  expect(await screen.findByRole('dialog')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Apply Filters' })
  ).not.toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(onChange).toHaveBeenLastCalledWith({
    username: 'alice',
    start_timestamp: new Date(2026, 9, 8),
    end_timestamp: now,
    time_granularity: 'hour',
  })
  expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})
