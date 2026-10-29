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

import { SetupWizard } from '../setup-wizard'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
}))

function renderWizard() {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/setup') {
      return {
        data: {
          success: true,
          data: { status: false, root_init: false, database_type: 'sqlite' },
        },
      }
    }
    return { data: { success: true, data: {} } }
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <SetupWizard />
    </QueryClientProvider>
  )
}

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await i18next.changeLanguage('en')
})

describe('setup step badges', () => {
  it('in English, numbers the steps 1 to 4', async () => {
    await i18next.changeLanguage('en')
    renderWizard()

    await screen.findByText('Database check')
    for (const digit of ['1', '2', '3', '4']) {
      expect(screen.getByText(digit)).toBeInTheDocument()
    }
  })

  it('in Persian, numbers the steps with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    renderWizard()

    await screen.findByText('Database check')
    for (const digit of ['۱', '۲', '۳', '۴']) {
      expect(screen.getByText(digit)).toBeInTheDocument()
    }
  })
})
