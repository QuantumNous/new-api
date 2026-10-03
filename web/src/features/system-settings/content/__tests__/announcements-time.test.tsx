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
import { render, screen, within } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ru from '@/i18n/locales/ru.json'
import zh from '@/i18n/locales/zh.json'

import { AnnouncementsSection } from '../announcements-section'

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)
const MINUTE = 60_000
const HOUR = 60 * MINUTE

async function renderAnnouncements(language: string, publishDate: string) {
  const i18n = createInstance()
  await i18n.init({
    lng: language,
    fallbackLng: 'en',
    resources: { en: { translation: {} }, zhCN: zh, ru },
    nsSeparator: false,
    interpolation: { escapeValue: false },
  })
  const data = JSON.stringify([
    {
      id: 1,
      content: 'Maintenance window',
      publishDate,
      type: 'default',
    },
  ])
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={i18n}>
        <AnnouncementsSection enabled data={data} />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('announcement publish date relative time', () => {
  it.each([
    { language: 'en', ago: 5 * MINUTE, expected: '5 minutes ago' },
    { language: 'en', ago: -2 * HOUR, expected: 'in 2 hours' },
    { language: 'zhCN', ago: 5 * MINUTE, expected: '5分钟前' },
    { language: 'ru', ago: 2 * HOUR, expected: '2 часа назад' },
    { language: 'ru', ago: 21 * MINUTE, expected: '21 минуту назад' },
  ])(
    'shows $expected in the $language interface',
    async ({ language, ago, expected }) => {
      await renderAnnouncements(language, new Date(NOW - ago).toISOString())

      expect(screen.getByText(expected)).toBeInTheDocument()
    }
  )

  it('shows - for a stored publish date that is not a date and still renders the row', async () => {
    await renderAnnouncements('en', 'not a date')

    const publishDateColumn = screen
      .getAllByRole('columnheader')
      .findIndex((header) => header.textContent === 'Publish Date')
    const row = screen.getByRole('row', { name: /Maintenance window/ })
    const publishDateCell = within(row).getAllByRole('cell')[publishDateColumn]
    expect(within(publishDateCell).getByText('-')).toBeInTheDocument()
  })
})
