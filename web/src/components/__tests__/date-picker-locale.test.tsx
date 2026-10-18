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
import { afterEach, expect, test, vi } from 'vitest'

import { DatePicker } from '../date-picker'
import { DateTimePicker } from '../datetime-picker'

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ locale }: { locale?: { code?: string } }) => (
    <div data-testid='calendar-locale'>{locale?.code ?? 'missing'}</div>
  ),
}))

const selected = new Date('2026-10-11T00:00:00')

async function setInterfaceLanguage(language: string) {
  if (!i18next.hasResourceBundle(language, 'translation')) {
    i18next.addResourceBundle(language, 'translation', {})
  }
  await act(() => i18next.changeLanguage(language))
}

async function openCalendar() {
  await userEvent.click(screen.getByRole('button', { name: /2026-10-11/ }))
  return screen.findByTestId('calendar-locale')
}

afterEach(async () => {
  await act(() => i18next.changeLanguage('en'))
})

test('uses Chinese calendar locales for zhCN and zhTW in both date pickers', async () => {
  await setInterfaceLanguage('zhCN')
  const datePicker = render(
    <DatePicker selected={selected} onSelect={() => undefined} />
  )
  expect(await openCalendar()).toHaveTextContent('zh-CN')
  datePicker.unmount()

  const dateTimePicker = render(
    <DateTimePicker value={selected} onChange={() => undefined} />
  )
  expect(await openCalendar()).toHaveTextContent('zh-CN')
  dateTimePicker.unmount()

  await setInterfaceLanguage('zhTW')
  render(<DatePicker selected={selected} onSelect={() => undefined} />)
  expect(await openCalendar()).toHaveTextContent('zh-TW')
})

test('keeps French on the French calendar locale', async () => {
  await setInterfaceLanguage('fr')
  render(<DatePicker selected={selected} onSelect={() => undefined} />)
  expect(await openCalendar()).toHaveTextContent('fr')
})
