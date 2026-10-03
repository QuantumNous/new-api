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

import { api } from '@/lib/api'

import { LogSettingsSection } from '../log-settings-section'

function renderSection(): void {
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => ({
    data:
      url === '/api/performance/logs'
        ? {
            success: true,
            data: {
              enabled: true,
              log_dir: '/var/log/app',
              file_count: 1234,
              total_size: 2048,
              oldest_time: '2026-09-01T00:00:00Z',
              newest_time: '2026-09-25T00:00:00Z',
            },
          }
        : { success: true, data: null },
  }))
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LogSettingsSection defaultEnabled />
    </QueryClientProvider>
  )
}

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await i18next.changeLanguage('en')
})

describe('server log file count', () => {
  it.each([
    { language: 'English', lng: 'en', count: '1234' },
    { language: 'Persian', lng: 'fa', count: '۱۲۳۴' },
  ])(
    'in $language, writes the log file count in the interface digits',
    async ({ lng, count }) => {
      await i18next.changeLanguage(lng)
      renderSection()
      const label = await screen.findByText('Log File Count:')
      expect(label.parentElement).toHaveTextContent(`Log File Count: ${count}`)
    }
  )
})
