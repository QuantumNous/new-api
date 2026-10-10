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

import { getUserLogStats } from '../../api'
import { CommonLogsStats } from '../common-logs-stats'

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: () => ({}) }),
}))
vi.mock('../usage-logs-provider', () => ({
  useLogsViewScope: () => ({ isAdminView: false }),
  useUsageLogsContext: () => ({ sensitiveVisible: true }),
}))
vi.mock('../../api', () => ({
  getLogStats: vi.fn(),
  getUserLogStats: vi.fn(),
}))

function renderStats(): void {
  vi.mocked(getUserLogStats).mockResolvedValue({
    success: true,
    data: { quota: 0, rpm: 1234, tpm: 56789 },
  } as Awaited<ReturnType<typeof getUserLogStats>>)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <CommonLogsStats />
    </QueryClientProvider>
  )
}

afterEach(async () => {
  cleanup()
  vi.clearAllMocks()
  await i18next.changeLanguage('en')
})

describe('usage log stats', () => {
  it('in English, keeps RPM and TPM as plain digits as before', async () => {
    await i18next.changeLanguage('en')
    renderStats()
    expect(await screen.findByText('1234')).toBeInTheDocument()
    expect(screen.getByText('56789')).toBeInTheDocument()
  })

  it('in Persian, writes RPM and TPM with Persian digits like the usage amount', async () => {
    await i18next.changeLanguage('fa')
    renderStats()
    expect(await screen.findByText('۱۲۳۴')).toBeInTheDocument()
    expect(screen.getByText('۵۶۷۸۹')).toBeInTheDocument()
  })
})
