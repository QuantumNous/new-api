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
import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getCheckinStatus } from '../../api'
import { CheckinCalendarCard } from '../checkin-calendar-card'

vi.mock('../../api', () => ({
  getCheckinStatus: vi.fn(),
  performCheckin: vi.fn(),
}))

function renderCard(): void {
  vi.mocked(getCheckinStatus).mockResolvedValue({
    success: true,
    data: {
      enabled: true,
      stats: {
        checked_in_today: false,
        total_checkins: 1234,
        total_quota: 0,
        checkin_count: 0,
        records: [],
      },
    },
  } as Awaited<ReturnType<typeof getCheckinStatus>>)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CheckinCalendarCard
        checkinEnabled
        turnstileEnabled={false}
        turnstileSiteKey=''
      />
    </QueryClientProvider>
  )
}

afterEach(async () => {
  cleanup()
  vi.clearAllMocks()
  await i18next.changeLanguage('en')
})

describe('check-in total', () => {
  it.each([
    { language: 'English', lng: 'en', total: '1234' },
    { language: 'Persian', lng: 'fa', total: '۱۲۳۴' },
  ])(
    'in $language, writes the total check-ins in the interface digits',
    async ({ lng, total }) => {
      await i18next.changeLanguage(lng)
      renderCard()
      const label = await screen.findByText('Total check-ins')
      expect(label.previousElementSibling?.textContent).toBe(total)
    }
  )
})
