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
import { afterEach, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/context/theme-provider'

import { ConsumptionDistributionChart } from '../consumption-distribution-chart'

// The chart canvas is outside this test; only the header is checked.
vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))
vi.mock('@visactor/vchart', () => ({
  ThemeManager: {
    registerTheme: () => undefined,
    setCurrentTheme: () => undefined,
  },
}))

afterEach(() => {
  cleanup()
})

it('isolates the quota total as a left-to-right value, so the currency symbol stays with the number on a right-to-left page', () => {
  render(
    <ThemeProvider>
      <div dir='rtl'>
        <ConsumptionDistributionChart
          data={[
            {
              created_at: 1_790_000_000,
              model_name: 'gpt-4.1',
              username: 'alice',
              quota: 11_490_000,
              count: 1,
              token_used: 10,
            },
          ]}
        />
      </div>
    </ThemeProvider>
  )

  const total = screen.getByText('$22.98')
  expect(total.tagName).toBe('BDI')
  expect(total).toHaveAttribute('dir', 'ltr')
})
