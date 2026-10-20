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
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import type { UserChartsFilters } from '@/features/dashboard/types'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'

import { UserCharts } from '../user-charts'

// VChart renders through the browser canvas, which jsdom cannot provide.
vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))
vi.mock('@visactor/vchart', () => ({
  ThemeManager: { setCurrentTheme: () => {} },
}))

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

afterEach(async () => {
  cleanup()
  client.clear()
  await i18next.changeLanguage('en')
  window.localStorage.clear()
})

function Dashboard() {
  const [visible, setVisible] = useState(true)
  const [filters, setFilters] = useState<UserChartsFilters>({
    metric: 'quota',
    timeGranularity: 'hour',
    selectedRange: 1,
    topUserLimit: 10,
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

test('Chinese locale translates the metric selector and both chart headings', async () => {
  vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}))
  i18next.addResourceBundle('zh', 'translation', zh.translation)
  await i18next.changeLanguage('zh')
  render(<Dashboard />)
  expect(screen.getByRole('tablist', { name: '统计指标' })).toBeInTheDocument()
  expect(screen.getByText('用户用量排名')).toBeInTheDocument()
  expect(screen.getByText('用户用量趋势')).toBeInTheDocument()
})
