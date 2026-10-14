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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { UpstreamOrchestration } from '../index'
import type { UpstreamOverview } from '../types'

const {
  createPairingCode,
  getUpstreamMetrics,
  getUpstreamOverview,
  getUpstreamPrices,
  reconcileUpstreams,
  requestUpstreamSync,
  updateUpstreamSettings,
  updateUpstreamRoute,
} = vi.hoisted(() => ({
  createPairingCode: vi.fn(),
  getUpstreamMetrics: vi.fn(),
  getUpstreamOverview: vi.fn(),
  getUpstreamPrices: vi.fn(),
  reconcileUpstreams: vi.fn(),
  requestUpstreamSync: vi.fn(),
  updateUpstreamSettings: vi.fn(),
  updateUpstreamRoute: vi.fn(),
}))

vi.mock('../api', () => ({
  createPairingCode,
  getUpstreamMetrics,
  getUpstreamOverview,
  getUpstreamPrices,
  reconcileUpstreams,
  requestUpstreamSync,
  updateUpstreamSettings,
  updateUpstreamRoute,
}))

vi.mock('@/components/page-transition', () => ({
  FadeIn: (props: { children: ReactNode }) => props.children,
}))

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  render(
    <QueryClientProvider client={client}>
      <UpstreamOrchestration />
    </QueryClientProvider>
  )
  return client
}

function successfulOverview(
  routes: UpstreamOverview['routes'] = []
): UpstreamOverview {
  return {
    settings: {
      enabled: true,
      auto_enroll: true,
      target_groups: ['default'],
      candidate_limit: 5,
      request_attempt_limit: 5,
      failover_budget_seconds: 90,
      probe_freshness_minutes: 15,
      failure_threshold: 2,
      failure_window_minutes: 5,
      red_long_term_hours: 24,
      sync_interval_hours: 4,
      daily_reconcile_time: '03:00',
      timezone: 'Asia/Shanghai',
      model_aliases: {},
      model_exclusions: {},
      protocol_model_exclusions: {},
    },
    sources: [],
    groups: [],
    routes,
    devices: [],
    commands: [],
    bark_configured: true,
  }
}

describe('upstream orchestration query states', () => {
  beforeEach(() => {
    createPairingCode.mockReset()
    getUpstreamMetrics.mockReset()
    getUpstreamOverview.mockReset()
    getUpstreamPrices.mockReset()
    reconcileUpstreams.mockReset()
    requestUpstreamSync.mockReset()
    updateUpstreamSettings.mockReset()
    updateUpstreamRoute.mockReset()
    getUpstreamMetrics.mockResolvedValue([])
    getUpstreamPrices.mockResolvedValue([])
  })

  test('keeps the Root badge in a full-width mobile title row above actions', () => {
    getUpstreamOverview.mockReturnValue(new Promise(() => undefined))

    const client = renderPage()
    const heading = screen.getByRole('heading', { level: 2 })
    const titleRegion = heading.parentElement

    expect(heading).toContainElement(screen.getByText('Root'))
    expect(titleRegion).toHaveClass('max-sm:basis-full')
    expect(titleRegion?.nextElementSibling).toContainElement(
      screen.getByRole('button', { name: 'Pair Chrome' })
    )
    client.clear()
  })

  test('shows loading instead of an empty route result while overview is pending', () => {
    getUpstreamOverview.mockReturnValue(new Promise(() => undefined))

    const client = renderPage()

    expect(screen.getByText('Loading...')).toBeVisible()
    expect(screen.queryByText('No managed routes')).not.toBeInTheDocument()
    client.clear()
  })

  test('shows the backend overview error instead of an empty route result', async () => {
    getUpstreamOverview.mockRejectedValue(
      new Error('Authoritative route data unavailable')
    )

    const client = renderPage()

    expect(
      await screen.findByText('Authoritative route data unavailable')
    ).toBeVisible()
    expect(screen.queryByText('No managed routes')).not.toBeInTheDocument()
    client.clear()
  })

  test('keeps cached overview and a dirty policy draft mounted when refetch fails', async () => {
    getUpstreamOverview.mockResolvedValue(successfulOverview())
    const client = renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('tab', { name: 'Automation' }))
    const targetGroups = screen.getByRole('textbox', {
      name: 'Target groups',
    })
    await user.clear(targetGroups)
    await user.type(targetGroups, 'default, canary')

    getUpstreamOverview.mockRejectedValueOnce(
      new Error('Overview refresh unavailable')
    )
    await client.refetchQueries({
      queryKey: ['upstream-orchestration'],
      exact: true,
    })

    expect(
      await screen.findByText('Overview refresh unavailable')
    ).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Target groups' })).toHaveValue(
      'default, canary'
    )
    client.clear()
  })

  test('shows a metrics query error in the usage tab', async () => {
    getUpstreamOverview.mockResolvedValue(successfulOverview())
    getUpstreamMetrics.mockRejectedValue(new Error('Metrics unavailable'))

    const client = renderPage()
    await userEvent.click(await screen.findByRole('tab', { name: 'Usage' }))

    expect(await screen.findByText('Metrics unavailable')).toBeVisible()
    client.clear()
  })

  test('does not imply HA when an active route lacks effective model data', async () => {
    getUpstreamOverview.mockResolvedValue(
      successfulOverview([
        {
          id: 1,
          source_id: 1,
          external_group_id: 'group',
          platform: 'openai',
          protocol: 'openai',
          channel_id: 1,
          state: 'active',
          detached: false,
          rank: 1,
          effective_multiplier: 1,
          effective_models: null,
          consecutive_failures: 0,
          consecutive_successes: 0,
        },
      ])
    )

    const client = renderPage()

    expect(await screen.findByText('Information unavailable')).toBeVisible()
    expect(screen.getByText('HA')).toBeVisible()
    client.clear()
  })

  test('does not report NON_HA when any active route has unknown model coverage', async () => {
    getUpstreamOverview.mockResolvedValue(
      successfulOverview([
        {
          id: 1,
          source_id: 1,
          external_group_id: 'known-group',
          platform: 'openai',
          protocol: 'openai',
          channel_id: 1,
          state: 'active',
          detached: false,
          rank: 1,
          effective_multiplier: 1,
          effective_models: ['known-model'],
          consecutive_failures: 0,
          consecutive_successes: 0,
        },
        {
          id: 2,
          source_id: 2,
          external_group_id: 'unknown-group',
          platform: 'openai',
          protocol: 'openai',
          channel_id: 2,
          state: 'active',
          detached: false,
          rank: 2,
          effective_multiplier: 1,
          effective_models: null,
          consecutive_failures: 0,
          consecutive_successes: 0,
        },
      ])
    )

    const client = renderPage()

    expect(await screen.findByText('Information unavailable')).toBeVisible()
    expect(screen.queryByText('NON_HA')).not.toBeInTheDocument()
    client.clear()
  })

  test('renders inactive and detached groups independently as unrouted', async () => {
    const overview = successfulOverview([
      {
        id: 1,
        source_id: 1,
        external_group_id: 'shadow-group',
        platform: 'openai',
        protocol: 'openai',
        channel_id: 1,
        state: 'shadow',
        detached: false,
        rank: 0,
        effective_multiplier: 1,
        effective_models: [],
        consecutive_failures: 0,
        consecutive_successes: 0,
      },
      {
        id: 2,
        source_id: 1,
        external_group_id: 'detached-group',
        platform: 'openai',
        protocol: 'openai',
        channel_id: 2,
        state: 'active',
        detached: true,
        rank: 0,
        effective_multiplier: 1,
        effective_models: [],
        consecutive_failures: 0,
        consecutive_successes: 0,
      },
    ])
    overview.sources = [
      {
        id: 1,
        key: 'leyi',
        name: 'Leyi',
        console_url: 'https://leyi.example',
        status: 'operational',
        enabled: true,
        low_balance_threshold: 5,
        last_snapshot_at: 1_800_000_000,
        last_success_at: 1_800_000_000,
      },
    ]
    overview.groups = [
      {
        id: 1,
        source_id: 1,
        external_id: 'shadow-group',
        name: 'Shadow group',
        platform: 'openai',
        effective_multiplier: 1,
        health_status: 'degraded',
        models: '["model-a","model-b"]',
        observed_at: 1_800_000_000,
      },
      {
        id: 2,
        source_id: 1,
        external_id: 'detached-group',
        name: 'Detached group',
        platform: 'openai',
        effective_multiplier: 1,
        health_status: 'operational',
        models: '[]',
        observed_at: 1_800_000_000,
      },
    ]
    getUpstreamOverview.mockResolvedValue(overview)

    const client = renderPage()

    expect(await screen.findByText('Unrouted groups')).toBeVisible()
    expect(screen.getByText('Leyi / Shadow group')).toBeVisible()
    expect(screen.getByText('leyi / shadow-group')).toBeVisible()
    expect(screen.getByText('degraded')).toBeVisible()
    expect(screen.getByText('model-a, model-b')).toBeVisible()
    expect(screen.getByText('No models reported')).toBeVisible()
    client.clear()
  })

  test('distinguishes a loaded empty unrouted result', async () => {
    getUpstreamOverview.mockResolvedValue(successfulOverview())

    const client = renderPage()

    expect(
      await screen.findByText('All discovered groups are routed')
    ).toBeVisible()
    client.clear()
  })
})
