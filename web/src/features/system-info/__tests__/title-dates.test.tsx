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

import { SystemInstancesPanel } from '../components/system-instances-panel'
import { SystemTasksTable } from '../components/system-tasks-table'
import type { SystemInstance } from '../types'

// 2026-09-25 15:05:09 local time is 3 Mehr 1405.
const SEEN = Math.floor(new Date(2026, 8, 25, 15, 5, 9).getTime() / 1000)

const instance: SystemInstance = {
  node_name: 'node-a',
  status: 'online',
  stale_after_seconds: 120,
  started_at: SEEN - 3600,
  last_seen_at: SEEN,
}

function renderInstances() {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, message: '', data: [instance] },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <SystemInstancesPanel />
    </QueryClientProvider>
  )
}

function renderTasks() {
  render(
    <SystemTasksTable
      tasks={[
        {
          id: 1,
          task_id: 'task-a',
          type: 'model_update',
          status: 'running',
          created_at: SEEN - 60,
          updated_at: SEEN,
        },
      ]}
    />
  )
}

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await i18next.changeLanguage('en')
})

describe('system info date titles', () => {
  it('in English, keeps the Gregorian last-seen title', async () => {
    await i18next.changeLanguage('en')
    renderInstances()

    expect(await screen.findByTitle('2026-09-25 15:05:09')).toBeInTheDocument()
  })

  it('in Persian, shows the last-seen title in Solar Hijri', async () => {
    await i18next.changeLanguage('fa')
    renderInstances()

    expect(await screen.findByTitle('۱۴۰۵/۰۷/۰۳ ۱۵:۰۵:۰۹')).toBeInTheDocument()
  })

  it('in English, keeps the Gregorian updated title of a task', async () => {
    await i18next.changeLanguage('en')
    renderTasks()

    expect(screen.getByTitle('2026-09-25 15:05:09')).toBeInTheDocument()
  })

  it('in Persian, shows the updated title of a task in Solar Hijri', async () => {
    await i18next.changeLanguage('fa')
    renderTasks()

    expect(screen.getByTitle('۱۴۰۵/۰۷/۰۳ ۱۵:۰۵:۰۹')).toBeInTheDocument()
  })
})
