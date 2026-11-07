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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PaymentLogsFilters } from '../components/payment-logs-filters'

function renderFilters(
  overrides: Partial<React.ComponentProps<typeof PaymentLogsFilters>> = {}
) {
  const props: React.ComponentProps<typeof PaymentLogsFilters> = {
    keyword: '',
    status: '',
    provider: '',
    fromDate: '',
    toDate: '',
    onKeywordChange: vi.fn(),
    onStatusChange: vi.fn(),
    onProviderChange: vi.fn(),
    onFromDateChange: vi.fn(),
    onToDateChange: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  }

  return { ...render(<PaymentLogsFilters {...props} />), props }
}

describe('PaymentLogsFilters', () => {
  it('debounces the keyword input before notifying the table', async () => {
    const user = userEvent.setup()
    const { props } = renderFilters()

    await user.type(screen.getByLabelText('Search'), 'USR123')

    await waitFor(
      () => expect(props.onKeywordChange).toHaveBeenLastCalledWith('USR123'),
      { timeout: 2000 }
    )
  })

  it('shows the selected dates as ISO Gregorian values', () => {
    renderFilters({ fromDate: '2026-02-03', toDate: '2026-11-07' })

    expect(screen.getByRole('button', { name: 'From date' })).toHaveTextContent(
      '2026-02-03'
    )
    expect(screen.getByRole('button', { name: 'To date' })).toHaveTextContent(
      '2026-11-07'
    )
  })

  it('enables reset only when a filter is active and clears the draft', async () => {
    const user = userEvent.setup()
    const { props } = renderFilters({ status: 'success' })

    const reset = screen.getByRole('button', { name: /Reset/ })
    expect(reset).toBeEnabled()

    await user.click(reset)
    expect(props.onReset).toHaveBeenCalledTimes(1)
  })

  it('disables reset when every filter is empty', () => {
    renderFilters()

    expect(screen.getByRole('button', { name: /Reset/ })).toBeDisabled()
  })
})
