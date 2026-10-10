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
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CompactDateTimeRangePicker } from '../compact-date-time-range-picker'

describe('CompactDateTimeRangePicker in Persian', () => {
  afterEach(async () => {
    await i18next.changeLanguage('en')
  })

  it('shows the range in Solar Hijri and keeps the Gregorian values', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const start = new Date(2026, 8, 25, 0, 0)
    const end = new Date(2026, 8, 25, 11, 35)
    await i18next.changeLanguage('fa')
    render(
      <CompactDateTimeRangePicker start={start} end={end} onChange={onChange} />
    )

    expect(
      screen.getByText('۱۴۰۵/۰۷/۰۳ ۰۰:۰۰ ~ ۱۴۰۵/۰۷/۰۳ ۱۱:۳۵')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /۱۴۰۵\/۰۷\/۰۳/ }))
    expect(await screen.findByLabelText('Start Time')).toHaveValue(
      '2026-09-25T00:00'
    )
    expect(screen.getByLabelText('End Time')).toHaveValue('2026-09-25T11:35')

    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onChange).toHaveBeenCalledWith({ start, end })
  })
})
