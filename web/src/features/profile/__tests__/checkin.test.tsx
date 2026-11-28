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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { CheckinCalendarCard } from '../components/checkin-calendar-card'

function renderCalendar(eligible?: boolean) {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        enabled: true,
        eligible,
        paid_users_only: true,
        stats: {
          checked_in_today: false,
          total_checkins: 0,
          total_quota: 0,
          checkin_count: 0,
          records: [],
        },
      },
    },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <CheckinCalendarCard
        checkinEnabled
        turnstileEnabled={false}
        turnstileSiteKey=''
      />
    </QueryClientProvider>
  )
}

test('an ineligible user sees the payment requirement and cannot claim', async () => {
  const post = vi.spyOn(api, 'post')
  renderCalendar(false)
  const claim = await screen.findByRole('button', { name: 'Payment required' })
  expect(claim).toBeDisabled()
  expect(
    screen.getByText('Check-in is available after a successful payment')
  ).toBeInTheDocument()
  fireEvent.click(claim)
  expect(post).not.toHaveBeenCalled()
})

test.each([true, undefined])(
  'an eligible user or legacy response (%s) can submit a claim',
  async (eligible) => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, data: { quota_awarded: 1000 } },
    })
    renderCalendar(eligible)
    const claim = await screen.findByRole('button', { name: 'Check in now' })
    expect(claim).toBeEnabled()
    fireEvent.click(claim)
    await waitFor(() => expect(post).toHaveBeenCalled())
  }
)
