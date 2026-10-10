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

import { DatePicker } from '../date-picker'
import { DateTimePicker } from '../datetime-picker'

// 2026-09-25 is 3 Mehr 1405.
const SEPTEMBER_25 = new Date(2026, 8, 25)

afterEach(async () => {
  await i18next.changeLanguage('en')
})

describe('DatePicker trigger text', () => {
  it('in English, shows the Gregorian date', async () => {
    await i18next.changeLanguage('en')
    render(<DatePicker selected={SEPTEMBER_25} onSelect={() => {}} />)

    expect(screen.getByRole('button')).toHaveTextContent('2026-09-25')
  })

  it('in Persian, shows the Solar Hijri date', async () => {
    await i18next.changeLanguage('fa')
    render(<DatePicker selected={SEPTEMBER_25} onSelect={() => {}} />)

    expect(screen.getByRole('button')).toHaveTextContent('۱۴۰۵/۰۷/۰۳')
  })
})

describe('DateTimePicker in Persian', () => {
  it('shows the Solar Hijri date on the trigger', async () => {
    await i18next.changeLanguage('fa')
    render(
      <DateTimePicker
        value={new Date(2026, 8, 25, 14, 30)}
        onChange={() => {}}
      />
    )

    expect(
      screen.getByRole('button', { name: /۱۴۰۵\/۰۷\/۰۳/ })
    ).toBeInTheDocument()
  })

  it('returns the Gregorian Date with the chosen time when 4 Mehr is picked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    await i18next.changeLanguage('fa')
    render(
      <DateTimePicker
        value={new Date(2026, 8, 25, 14, 30)}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('button', { name: /۱۴۰۵\/۰۷\/۰۳/ }))
    await user.click(
      await screen.findByRole('button', { name: /(^|\s)۴-ام مهر ۱۴۰۵/ })
    )

    expect(onChange).toHaveBeenCalledWith(new Date(2026, 8, 26, 14, 30))
  })
})
