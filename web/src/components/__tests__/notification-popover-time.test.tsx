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
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'

import { NotificationPopover } from '../notification-popover'

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

async function renderAnnouncement(language: string, publishDate: Date) {
  const i18n = createInstance()
  await i18n.init({
    lng: language,
    fallbackLng: 'en',
    resources: { en, zhCN: zh, zhTW, ru },
    nsSeparator: false,
    interpolation: { escapeValue: false },
  })
  render(
    <I18nextProvider i18n={i18n}>
      <NotificationPopover
        open
        onOpenChange={() => undefined}
        unreadCount={1}
        activeTab='announcements'
        onTabChange={() => undefined}
        notice=''
        announcements={[{ id: 1, content: 'Maintenance window', publishDate }]}
        loading={false}
      />
    </I18nextProvider>
  )
  return i18n
}

// The line reads "<relative time> • <absolute date>".
function shownTime() {
  return screen.getByText(/ • /).textContent?.split(' • ')[0]
}

// The popover's ScrollArea waits for animations; jsdom has no getAnimations.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('notification popover announcement time', () => {
  it.each([
    { language: 'en', ago: 30 * SECOND, expected: 'Just now' },
    { language: 'en', ago: 21 * MINUTE, expected: '21 minutes ago' },
    { language: 'en', ago: 28 * DAY, expected: '28 days ago' },
    { language: 'en', ago: 29 * DAY, expected: '29 days ago' },
    { language: 'zhCN', ago: 30 * SECOND, expected: '刚刚' },
    { language: 'zhCN', ago: 2 * HOUR, expected: '2小时前' },
    { language: 'zhCN', ago: 28 * DAY, expected: '28天前' },
    { language: 'zhTW', ago: 2 * HOUR, expected: '2 小時前' },
    { language: 'ru', ago: 2 * HOUR, expected: '2 часа назад' },
    { language: 'ru', ago: 21 * MINUTE, expected: '21 минуту назад' },
    { language: 'ru', ago: 29 * DAY, expected: '29 дней назад' },
  ])(
    'shows $expected for a date published that long ago in the $language interface',
    async ({ language, ago, expected }) => {
      await renderAnnouncement(language, new Date(NOW - ago))

      expect(shownTime()).toBe(expected)
    }
  )

  it('updates the relative time when the interface language changes', async () => {
    const i18n = await renderAnnouncement('en', new Date(NOW - 2 * HOUR))
    expect(shownTime()).toBe('2 hours ago')

    await act(() => i18n.changeLanguage('ru'))

    expect(shownTime()).toBe('2 часа назад')
  })

  // Local-time dates keep the expected YYYY-MM-DD HH:mm:ss text independent
  // of the machine's time zone.
  it('shows the absolute date instead of a relative time for a date in the future', async () => {
    vi.setSystemTime(new Date(2026, 9, 3, 12, 0, 0))

    await renderAnnouncement('ru', new Date(2026, 9, 4, 9, 30, 0))

    expect(shownTime()).toBe('2026-10-04 09:30:00')
  })

  it('shows the absolute date instead of a relative time for a date two years old', async () => {
    vi.setSystemTime(new Date(2026, 9, 3, 12, 0, 0))

    await renderAnnouncement('ru', new Date(2024, 9, 3, 9, 30, 0))

    expect(shownTime()).toBe('2024-10-03 09:30:00')
  })
})
