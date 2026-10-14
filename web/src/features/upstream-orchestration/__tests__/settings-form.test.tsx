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
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { UpstreamOrchestration } from '../index'
import type { UpstreamOverview } from '../types'

const {
  getUpstreamMetrics,
  getUpstreamOverview,
  getUpstreamPrices,
  updateUpstreamSettings,
  toastError,
  toastSuccess,
} = vi.hoisted(() => ({
  getUpstreamMetrics: vi.fn(),
  getUpstreamOverview: vi.fn(),
  getUpstreamPrices: vi.fn(),
  updateUpstreamSettings: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('../api', () => ({
  createPairingCode: vi.fn(),
  getUpstreamMetrics,
  getUpstreamOverview,
  getUpstreamPrices,
  reconcileUpstreams: vi.fn(),
  requestUpstreamSync: vi.fn(),
  updateUpstreamSettings,
  updateUpstreamRoute: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}))

vi.mock('@/components/page-transition', () => ({
  FadeIn: (props: { children: ReactNode }) => props.children,
}))

const overview: UpstreamOverview = {
  settings: {
    enabled: true,
    auto_enroll: true,
    target_groups: ['default', 'vip'],
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
    model_aliases: { public: 'upstream' },
    model_exclusions: { 'leyi:paid': ['blocked'] },
    protocol_model_exclusions: { openai: ['unsupported'] },
  },
  sources: [],
  groups: [],
  routes: [],
  devices: [],
  commands: [],
  bark_configured: true,
}

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

async function openPolicyForm() {
  await userEvent.click(await screen.findByRole('tab', { name: 'Automation' }))
  return {
    targetGroups: screen.getByRole('textbox', { name: 'Target groups' }),
    modelAliases: screen.getByRole('textbox', {
      name: 'Model aliases (JSON)',
    }),
    modelExclusions: screen.getByRole('textbox', {
      name: 'Model exclusions (JSON)',
    }),
    protocolExclusions: screen.getByRole('textbox', {
      name: 'Protocol exclusions (JSON)',
    }),
  }
}

describe('upstream routing policy form', () => {
  beforeEach(() => {
    getUpstreamMetrics.mockReset()
    getUpstreamOverview.mockReset()
    getUpstreamPrices.mockReset()
    updateUpstreamSettings.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
    getUpstreamOverview.mockResolvedValue(overview)
    getUpstreamMetrics.mockResolvedValue([])
    getUpstreamPrices.mockResolvedValue([])
  })

  test('initializes every editable field from the overview without mutating', async () => {
    const client = renderPage()
    const fields = await openPolicyForm()

    expect(fields.targetGroups).toHaveValue('default, vip')
    expect(fields.modelAliases).toHaveValue('{\n  "public": "upstream"\n}')
    expect(fields.modelExclusions).toHaveValue(
      '{\n  "leyi:paid": [\n    "blocked"\n  ]\n}'
    )
    expect(fields.protocolExclusions).toHaveValue(
      '{\n  "openai": [\n    "unsupported"\n  ]\n}'
    )
    expect(updateUpstreamSettings).not.toHaveBeenCalled()
    client.clear()
  })

  test('does not mutate while editing and cancel restores server values', async () => {
    const client = renderPage()
    const fields = await openPolicyForm()

    await userEvent.clear(fields.targetGroups)
    await userEvent.type(fields.targetGroups, 'default, canary')
    expect(updateUpstreamSettings).not.toHaveBeenCalled()

    await userEvent.click(
      screen.getByRole('button', { name: 'Cancel changes' })
    )
    expect(fields.targetGroups).toHaveValue('default, vip')
    expect(updateUpstreamSettings).not.toHaveBeenCalled()
    client.clear()
  })

  test('preserves a dirty draft during polling and cancel adopts the latest server values', async () => {
    const client = renderPage()
    const fields = await openPolicyForm()
    const remoteOverview: UpstreamOverview = {
      ...overview,
      settings: {
        ...overview.settings,
        target_groups: ['remote'],
        candidate_limit: 7,
      },
    }

    await userEvent.clear(fields.targetGroups)
    await userEvent.type(fields.targetGroups, 'default, canary')
    getUpstreamOverview.mockResolvedValueOnce(remoteOverview)
    await client.refetchQueries({
      queryKey: ['upstream-orchestration'],
      exact: true,
    })

    expect(await screen.findByText('7')).toBeVisible()
    expect(fields.targetGroups).toHaveValue('default, canary')

    await userEvent.click(
      screen.getByRole('button', { name: 'Cancel changes' })
    )
    expect(fields.targetGroups).toHaveValue('remote')
    expect(updateUpstreamSettings).not.toHaveBeenCalled()
    client.clear()
  })

  test('adopts polling updates while the policy form is pristine', async () => {
    const client = renderPage()
    const fields = await openPolicyForm()
    const remoteOverview: UpstreamOverview = {
      ...overview,
      settings: {
        ...overview.settings,
        target_groups: ['remote'],
        candidate_limit: 7,
      },
    }

    getUpstreamOverview.mockResolvedValueOnce(remoteOverview)
    await client.refetchQueries({
      queryKey: ['upstream-orchestration'],
      exact: true,
    })

    expect(await screen.findByText('7')).toBeVisible()
    expect(fields.targetGroups).toHaveValue('remote')
    expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled()
    client.clear()
  })

  test('adopts a deferred polling update after the draft becomes pristine', async () => {
    const client = renderPage()
    const fields = await openPolicyForm()
    const remoteOverview: UpstreamOverview = {
      ...overview,
      settings: {
        ...overview.settings,
        target_groups: ['remote'],
        candidate_limit: 7,
      },
    }

    await userEvent.clear(fields.targetGroups)
    await userEvent.type(fields.targetGroups, 'default, canary')
    getUpstreamOverview.mockResolvedValueOnce(remoteOverview)
    await client.refetchQueries({
      queryKey: ['upstream-orchestration'],
      exact: true,
    })
    expect(await screen.findByText('7')).toBeVisible()
    expect(fields.targetGroups).toHaveValue('default, canary')

    await userEvent.clear(fields.targetGroups)
    await userEvent.type(fields.targetGroups, 'default, vip')

    await waitFor(() => expect(fields.targetGroups).toHaveValue('remote'))
    expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled()
    client.clear()
  })

  test('invalid JSON marks the field invalid and blocks save', async () => {
    const client = renderPage()
    const fields = await openPolicyForm()

    await userEvent.clear(fields.modelAliases)
    await userEvent.type(fields.modelAliases, 'not json')

    expect(fields.modelAliases).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Enter a valid JSON object')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled()
    expect(updateUpstreamSettings).not.toHaveBeenCalled()
    client.clear()
  })

  test('keys that collide after trimming are rejected before save', async () => {
    const client = renderPage()
    const fields = await openPolicyForm()

    fireEvent.change(fields.modelAliases, {
      target: { value: '{" public":"first","public":"second"}' },
    })

    await waitFor(() =>
      expect(fields.modelAliases).toHaveAttribute('aria-invalid', 'true')
    )
    expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled()
    expect(updateUpstreamSettings).not.toHaveBeenCalled()
    client.clear()
  })

  test('successful save sends one exact snapshot and refreshes overview', async () => {
    updateUpstreamSettings.mockResolvedValue(overview.settings)
    const client = renderPage()
    const fields = await openPolicyForm()

    await userEvent.clear(fields.targetGroups)
    await userEvent.type(fields.targetGroups, ' default, canary, default ')
    await userEvent.click(screen.getByRole('button', { name: 'Save policy' }))

    await waitFor(() =>
      expect(updateUpstreamSettings).toHaveBeenCalledWith({
        target_groups: ['default', 'canary'],
        model_aliases: { public: 'upstream' },
        model_exclusions: { 'leyi:paid': ['blocked'] },
        protocol_model_exclusions: { openai: ['unsupported'] },
      })
    )
    await waitFor(() => expect(getUpstreamOverview).toHaveBeenCalledTimes(2))
    expect(toastSuccess).toHaveBeenCalledWith('Routing policy saved')
    client.clear()
  })

  test('empty alias values are trimmed and preserved in the exact payload', async () => {
    updateUpstreamSettings.mockResolvedValue(overview.settings)
    const client = renderPage()
    const fields = await openPolicyForm()
    const user = userEvent.setup()

    await user.clear(fields.modelAliases)
    await user.click(fields.modelAliases)
    await user.paste('{" public ":"   "}')

    await waitFor(() =>
      expect(fields.modelAliases).toHaveAttribute('aria-invalid', 'false')
    )
    expect(screen.getByRole('button', { name: 'Cancel changes' })).toBeEnabled()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save policy' })).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Save policy' }))
    await waitFor(() =>
      expect(updateUpstreamSettings).toHaveBeenCalledWith({
        target_groups: ['default', 'vip'],
        model_aliases: { public: '' },
        model_exclusions: { 'leyi:paid': ['blocked'] },
        protocol_model_exclusions: { openai: ['unsupported'] },
      })
    )
    client.clear()
  })

  test('business failure shows the server error without success feedback', async () => {
    updateUpstreamSettings.mockRejectedValue(
      new Error('Routing policy was rejected')
    )
    const client = renderPage()
    const fields = await openPolicyForm()

    await userEvent.clear(fields.targetGroups)
    await userEvent.type(fields.targetGroups, 'default, canary')
    await userEvent.click(screen.getByRole('button', { name: 'Save policy' }))

    expect(await screen.findByText('Routing policy was rejected')).toBeVisible()
    expect(toastError).toHaveBeenCalledWith('Routing policy was rejected')
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(getUpstreamOverview).toHaveBeenCalledTimes(1)
    client.clear()
  })
})
