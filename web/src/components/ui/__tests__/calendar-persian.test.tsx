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
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '../calendar'
import { DirectionProvider } from '../direction'

// 2026-09-25 is 3 Mehr 1405.
const SEPTEMBER_25 = new Date(2026, 8, 25)

afterEach(async () => {
  await i18next.changeLanguage('en')
})

function renderCalendar(onSelect = vi.fn()) {
  render(
    <DirectionProvider direction='rtl'>
      <Calendar
        mode='single'
        defaultMonth={SEPTEMBER_25}
        selected={undefined}
        onSelect={onSelect}
      />
    </DirectionProvider>
  )
  return onSelect
}

describe('Calendar calendar system', () => {
  it('in English, renders the Gregorian month synchronously', async () => {
    await i18next.changeLanguage('en')
    renderCalendar()

    expect(
      screen.getByRole('grid', { name: 'September 2026' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /September 25th, 2026/ })
    ).toHaveTextContent(/^25$/)
  })

  it('in Persian, shows the Solar Hijri month with Persian digits and the provider direction', async () => {
    await i18next.changeLanguage('fa')
    renderCalendar()

    expect(
      await screen.findByRole('grid', { name: 'مهر ۱۴۰۵' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /(^|\s)۳-ام مهر ۱۴۰۵/ })
    ).toHaveTextContent(/^۳$/)
    expect(document.querySelector('[data-slot="calendar"]')).toHaveAttribute(
      'dir',
      'rtl'
    )
  })

  it('in Persian, selecting 3 Mehr returns the same Date as selecting September 25 in English', async () => {
    const user = userEvent.setup()
    await i18next.changeLanguage('en')
    const onSelectEn = renderCalendar()
    await user.click(
      screen.getByRole('button', { name: /September 25th, 2026/ })
    )
    const gregorianDate: Date = onSelectEn.mock.calls[0][0]
    cleanup()

    await act(async () => {
      await i18next.changeLanguage('fa')
    })
    const onSelectFa = renderCalendar()
    await user.click(
      await screen.findByRole('button', { name: /(^|\s)۳-ام مهر ۱۴۰۵/ })
    )
    const persianDate: Date = onSelectFa.mock.calls[0][0]

    expect(gregorianDate.getTime()).toBe(SEPTEMBER_25.getTime())
    expect(persianDate.getTime()).toBe(gregorianDate.getTime())
  })

  it('switches between the Gregorian and Persian calendars without a reload', async () => {
    await i18next.changeLanguage('en')
    renderCalendar()
    expect(
      screen.getByRole('grid', { name: 'September 2026' })
    ).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('fa')
    })
    expect(
      await screen.findByRole('grid', { name: 'مهر ۱۴۰۵' })
    ).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('en')
    })
    expect(
      screen.getByRole('grid', { name: 'September 2026' })
    ).toBeInTheDocument()
  })
})
