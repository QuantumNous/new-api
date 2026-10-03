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
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CompactDateTimeRangePicker } from '../compact-date-time-range-picker'

describe('CompactDateTimeRangePicker direction', () => {
  it('isolates a selected date range so RTL pages keep start before end', () => {
    render(
      <div dir='rtl'>
        <CompactDateTimeRangePicker
          start={new Date(2026, 8, 25, 0, 0)}
          end={new Date(2026, 8, 25, 11, 35)}
          onChange={() => {}}
        />
      </div>
    )

    const label = screen.getByText('2026-09-25 00:00 ~ 2026-09-25 11:35')
    expect(label).toHaveAttribute('dir', 'auto')
  })

  it('isolates the placeholder label so it follows its own script', () => {
    render(<CompactDateTimeRangePicker onChange={() => {}} />)

    for (const label of screen.getAllByText('Date Range')) {
      expect(label).toHaveAttribute('dir', 'auto')
    }
  })
})
