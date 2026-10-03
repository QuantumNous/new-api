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
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { SystemInstancesPanel } from '../components/system-instances-panel'
import { SystemTasksPanel } from '../components/system-tasks-panel'
import { SystemTasksTable } from '../components/system-tasks-table'
import type { SystemInstance } from '../types'

const instance: SystemInstance = {
  node_name: 'node-a',
  status: 'online',
  stale_after_seconds: 120,
  started_at: 1_790_000_000,
  last_seen_at: 1_790_000_100,
  info: { resources: { cpu: { usage_percent: 45.2 } } },
}

function renderWithClient(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>)
}

function mockApi() {
  vi.spyOn(api, 'get').mockImplementation(async (url, config) => {
    if (url === '/api/system-info/instances') {
      return { data: { success: true, message: '', data: [instance] } }
    }
    if (config?.params?.scope === 'active') {
      return {
        data: {
          success: true,
          data: [
            {
              id: 2,
              task_id: 'a',
              type: 'model_update',
              status: 'running',
              created_at: 100,
              updated_at: 200,
            },
          ],
          total: 1,
        },
      }
    }
    return { data: { success: true, data: [], total: 0 } }
  })
}

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await i18next.changeLanguage('en')
})

describe('system info numbers', () => {
  it('in English, keeps the CPU percentage and refresh interval as before', async () => {
    await i18next.changeLanguage('en')
    mockApi()
    renderWithClient(<SystemInstancesPanel />)

    expect(await screen.findByText('45.2%')).toBeInTheDocument()
    expect(screen.getByText('Auto-refreshing every 30s')).toBeInTheDocument()
  })

  it('in Persian, writes the CPU percentage and refresh interval with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    mockApi()
    renderWithClient(<SystemInstancesPanel />)

    expect(await screen.findByText('۴۵٫۲٪')).toBeInTheDocument()
    expect(screen.getByText(/every ۳۰s/)).toBeInTheDocument()
  })

  it.each([
    ['en', '75%'],
    ['fa', '۷۵٪'],
  ])('in %s, writes the task progress as %s', async (language, expected) => {
    await i18next.changeLanguage(language)
    render(
      <SystemTasksTable
        tasks={[
          {
            id: 3,
            task_id: 'b',
            type: 'model_update',
            status: 'running',
            created_at: 100,
            updated_at: 200,
            state: { progress: 75 },
          },
        ]}
      />
    )

    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('in Persian, writes the task refresh interval with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    mockApi()
    renderWithClient(<SystemTasksPanel />)

    expect(await screen.findByText(/every ۸s/)).toBeInTheDocument()
  })

  it('in Persian, writes the active task count with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    mockApi()
    renderWithClient(<SystemTasksPanel />)

    await screen.findByText(/every ۸s/)
    expect(screen.getByText('۱')).toBeInTheDocument()
  })
})
