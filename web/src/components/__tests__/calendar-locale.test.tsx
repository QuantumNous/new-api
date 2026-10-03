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
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DatePicker } from '../date-picker'
import { DateTimePicker } from '../datetime-picker'

const pickers = [
  {
    name: 'DatePicker',
    trigger: 'Pick a date',
    element: <DatePicker selected={undefined} onSelect={() => undefined} />,
  },
  {
    name: 'DateTimePicker',
    trigger: 'Select date',
    element: <DateTimePicker />,
  },
]

const english = {
  caption: 'October 2026',
  weekdays: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
}
const chinese = {
  caption: '2026年10月',
  weekdays: ['一', '二', '三', '四', '五', '六', '日'],
}

const languages = [
  { language: 'zhCN', ...chinese },
  { language: 'zhTW', ...chinese },
  { language: 'en', ...english },
  {
    language: 'ja',
    caption: '2026年10月',
    weekdays: ['日', '月', '火', '水', '木', '金', '土'],
  },
  {
    language: 'fr',
    caption: 'octobre 2026',
    weekdays: ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'],
  },
  {
    language: 'ru',
    caption: 'октябрь 2026',
    weekdays: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
  },
  {
    language: 'vi',
    caption: 'Tháng Mười 2026',
    weekdays: ['Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7', 'CN'],
  },
  { language: 'de', ...english },
]

// react-day-picker hides the weekday row from assistive technology because
// each day button carries its full date label; the row is still on screen.
function weekdayHeaders() {
  return screen
    .getAllByRole('columnheader', { hidden: true })
    .map((header) => header.textContent)
}

beforeEach(() => {
  // The calendar opens on the current month; fix it so captions are stable.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 12))
})

afterEach(async () => {
  vi.useRealTimers()
  await act(() => i18next.changeLanguage('en'))
})

describe.each(pickers)('$name calendar locale', (picker) => {
  it.each(languages)(
    'shows $caption with weekdays $weekdays.0 to $weekdays.6 in the $language interface',
    async ({ language, caption, weekdays }) => {
      await act(() => i18next.changeLanguage(language))
      const user = userEvent.setup()
      render(picker.element)

      await user.click(screen.getByRole('button', { name: picker.trigger }))

      expect(screen.getByRole('status')).toHaveTextContent(caption)
      expect(weekdayHeaders()).toEqual(weekdays)
    }
  )

  it('switches the open calendar to Traditional Chinese when the interface language changes', async () => {
    const user = userEvent.setup()
    render(picker.element)
    await user.click(screen.getByRole('button', { name: picker.trigger }))
    expect(screen.getByRole('status')).toHaveTextContent(english.caption)

    await act(() => i18next.changeLanguage('zhTW'))

    expect(screen.getByRole('status')).toHaveTextContent(chinese.caption)
    expect(weekdayHeaders()).toEqual(chinese.weekdays)
  })
})
