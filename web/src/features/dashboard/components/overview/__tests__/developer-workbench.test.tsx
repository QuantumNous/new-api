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
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api } from '@/lib/api'
import { formatQuota } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { useConsoleModeStore } from '@/stores/console-mode-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'
import { renderApp } from '@/test-utils/render-app'

import { OverviewDashboard } from '../overview-dashboard'

const originalAdapter = api.defaults.adapter
const originalMode = useConsoleModeStore.getState().mode
let client: QueryClient
let requestedPaths: string[] = []

beforeEach(() => {
  requestedPaths = []
  const bundle = createTestAuthBundle()
  useAuthStore.getState().auth.setBundle({
    ...bundle,
    user: {
      ...bundle.user,
      request_count: 3740,
      quota: 5000000,
      used_quota: 1000000,
    },
  })
  useConsoleModeStore.getState().setMode('developer')
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  client.setQueryData(['status'], {
    api_info_enabled: false,
    announcements_enabled: false,
    faq_enabled: false,
    uptime_kuma_enabled: true,
  })
  api.defaults.adapter = async (config) => {
    const path = new URL(config.url ?? '', 'http://localhost').pathname
    requestedPaths.push(path)
    let data: unknown
    if (path === '/api/token/') {
      data = {
        items: [{ id: 42, status: 1, name: 'app-key', key: 'masked****' }],
        total: 1,
      }
    } else if (path === '/api/user/models') {
      data = ['example-model']
    } else if (path === '/api/data/self') {
      data = [
        {
          created_at: config.params.end_timestamp - 60,
          quota: 250000,
          count: 8,
          token_used: 1200,
          model_name: 'example-model',
          username: 'demo',
        },
      ]
    } else if (path === '/api/uptime/status') {
      data = []
    } else if (path === '/api/perf-metrics/summary') {
      data = {
        models: [
          {
            model_name: 'example-model',
            success_rate: 0.95,
            avg_latency_ms: 2000,
            avg_tps: 25,
            request_count: 100,
          },
        ],
      }
    } else {
      throw new Error(`Unexpected request: ${path}`)
    }
    return {
      config,
      data: { success: true, data },
      status: 200,
      statusText: 'OK',
      headers: {},
    }
  }
})

afterEach(() => {
  cleanup()
  client.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
  useConsoleModeStore.getState().setMode(originalMode)
})

describe('developer overview summary', () => {
  it('shows status and usage panels without a request table, request search or setup wizard', async () => {
    await renderApp(<OverviewDashboard />, client)
    expect(await screen.findByText('Usage at a glance')).toBeVisible()
    expect(screen.getByText('Historical Usage')).toBeVisible()
    expect(screen.getByText('Request Count')).toBeVisible()
    expect(screen.getByText('Route active')).toBeVisible()
    expect(screen.getByText('Auth configured')).toBeVisible()
    expect(screen.getByText('Model selected')).toBeVisible()
    await waitFor(() =>
      expect(screen.getAllByText(formatQuota(250000)).length).toBeGreaterThan(0)
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent requests')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Request ID' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Show setup guide' })
    ).not.toBeInTheDocument()
    expect(requestedPaths.some((path) => path.startsWith('/api/log'))).toBe(
      false
    )
  })

  it('shows administrator health and configured uptime panels directly without an extra disclosure', async () => {
    const bundle = createTestAuthBundle()
    useAuthStore
      .getState()
      .auth.setBundle({ ...bundle, user: { ...bundle.user, role: ROLE.ADMIN } })
    await renderApp(<OverviewDashboard />, client)
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Performance health' })
      ).toBeVisible()
    )
    await waitFor(() =>
      expect(screen.getByText('No uptime monitoring configured')).toBeVisible()
    )
    expect(
      screen.queryByRole('button', { name: 'Service information & help' })
    ).not.toBeInTheDocument()
    await waitFor(() =>
      expect(requestedPaths).toContain('/api/perf-metrics/summary')
    )
  })

  it('does not request or reveal administrator health data to an ordinary account', async () => {
    await renderApp(<OverviewDashboard />, client)
    await screen.findByText('No uptime monitoring configured')
    expect(
      screen.queryByRole('heading', { name: 'Performance health' })
    ).not.toBeInTheDocument()
    expect(requestedPaths).not.toContain('/api/perf-metrics/summary')
  })
})
