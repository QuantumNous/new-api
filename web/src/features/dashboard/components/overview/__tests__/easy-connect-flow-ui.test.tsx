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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createApiKey } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { getUserGroupModels, getUserGroups, getUserModels } from '@/lib/api'

import { EasyConnectFlow } from '../easy-connect-flow'

const { copyToClipboard } = vi.hoisted(() => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: ReactNode; className?: string; to: string }) => (
    <a className={props.className} href={props.to}>
      {props.children}
    </a>
  ),
}))

vi.mock('@/features/guide/use-guide-address', () => ({
  useGuideAddress: () => ({
    host: 'https://api.example.com',
    baseUrl: 'https://api.example.com/v1',
    fullUrl: 'https://api.example.com/v1/chat/completions',
    fill: (value: string) => value,
  }),
}))

vi.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({ copiedText: null, copyToClipboard }),
}))

vi.mock('@/features/keys/api', () => ({
  createApiKey: vi.fn(),
  fetchTokenKey: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  getUserGroups: vi.fn(),
  getUserModels: vi.fn(),
  getUserGroupModels: vi.fn(),
}))

const DEEPSEEK = 'deepseek-v4-flash-0731'

function renderFlow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <EasyConnectFlow />
    </QueryClientProvider>
  )
  return queryClient
}

function chooseModel(model: string) {
  const input = screen.getByRole('combobox')
  fireEvent.pointerDown(input)
  act(() => input.focus())
  fireEvent.mouseDown(screen.getByRole('option', { name: model }))
}

function createdKey(): ApiKey {
  return {
    id: 8,
    name: 'Easy setup',
    key: 'new-secret',
    status: 1,
    remain_quota: 0,
    used_quota: 0,
    unlimited_quota: true,
    expired_time: -1,
    created_time: 1,
    accessed_time: 0,
    group: 'discount',
    auto_groups: null,
    cross_group_retry: false,
    model_limits_enabled: true,
    model_limits: DEEPSEEK,
    allow_ips: '',
  }
}

describe('easy connect flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUserModels).mockResolvedValue({
      success: true,
      data: [DEEPSEEK, 'gpt-5.6', 'minimax-m3'],
    })
    vi.mocked(getUserGroups).mockResolvedValue({
      success: true,
      data: {
        discount: { desc: 'Value route', ratio: 0.8 },
        codex: { desc: 'Codex route', ratio: 0.13 },
        auto: { desc: 'auto', ratio: '自动' },
      },
    })
    vi.mocked(getUserGroupModels).mockImplementation(async (group) => ({
      success: true,
      data: group === 'discount' ? [DEEPSEEK] : ['gpt-5.6'],
    }))
    vi.mocked(createApiKey).mockResolvedValue({
      success: true,
      data: createdKey(),
    })
  })

  it('creates a model-limited key and copies the three values as one bundle', async () => {
    renderFlow()

    expect(await screen.findByText('About 8 off · saves 20%')).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Generate connection details' })
    )

    expect(
      await screen.findByText('Your connection pass is ready')
    ).toBeVisible()
    expect(createApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        group: 'discount',
        model_limits_enabled: true,
        model_limits: DEEPSEEK,
        unlimited_quota: true,
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy everything' }))
    expect(copyToClipboard).toHaveBeenCalledWith(
      [
        'API address: https://api.example.com/v1',
        'API key: sk-new-secret',
        `Model: ${DEEPSEEK}`,
      ].join('\n')
    )
  })

  it('does not offer Codex or automatic routes when they cannot serve the selected DeepSeek model', async () => {
    renderFlow()
    expect(
      await screen.findByRole('radio', { name: /Value route/ })
    ).toBeVisible()
    expect(screen.queryByRole('radio', { name: /Codex route/ })).toBeNull()
    expect(screen.queryByRole('radio', { name: /Automatic route/ })).toBeNull()
  })

  it('replaces an incompatible route and hides old connection details when the model changes', async () => {
    renderFlow()
    await screen.findByRole('radio', { name: /Value route/ })
    chooseModel('gpt-5.6')
    fireEvent.click(await screen.findByRole('radio', { name: /Codex route/ }))
    expect(screen.getByRole('radio', { name: /Automatic route/ })).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Generate connection details' })
    )
    await screen.findByRole('button', { name: 'Copy everything' })

    chooseModel(DEEPSEEK)

    expect(screen.queryByRole('radio', { name: /Codex route/ })).toBeNull()
    expect(screen.getByRole('radio', { name: /Value route/ })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.queryByRole('button', { name: 'Copy everything' })).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Generate connection details' })
    )
    await screen.findByRole('button', { name: 'Copy everything' })
    expect(createApiKey).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model_limits: DEEPSEEK,
        group: 'discount',
      })
    )
  })

  it('does not generate a connection while route support is still being checked', async () => {
    let resolveModels!: (
      result: Awaited<ReturnType<typeof getUserGroupModels>>
    ) => void
    vi.mocked(getUserGroupModels).mockReturnValue(
      new Promise((resolve) => {
        resolveModels = resolve
      })
    )
    // One route keeps the pending response explicit and deterministic.
    vi.mocked(getUserGroups).mockResolvedValue({
      success: true,
      data: { discount: { desc: 'Value route', ratio: 0.8 } },
    })
    renderFlow()
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toHaveValue(DEEPSEEK)
    )
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(
      screen.getByRole('button', { name: 'Generate connection details' })
    ).toBeDisabled()
    await act(async () => resolveModels({ success: true, data: [DEEPSEEK] }))
    expect(
      await screen.findByRole('radio', { name: /Value route/ })
    ).toBeVisible()
  })

  it('shows an empty state instead of falling back to all routes for an unsupported model', async () => {
    renderFlow()
    await screen.findByRole('radio', { name: /Value route/ })
    chooseModel('minimax-m3')
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(
      screen.getByText(
        'No billing route supports this model. Choose another model or contact support.'
      )
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Generate connection details' })
    ).toBeDisabled()
  })

  it.each(['network', 'api'] as const)(
    'does not assume support after a %s failure and lets the user retry',
    async (failure) => {
      if (failure === 'network') {
        vi.mocked(getUserGroupModels).mockRejectedValue(new Error('offline'))
      } else {
        vi.mocked(getUserGroupModels).mockResolvedValue({
          success: false,
          message: 'unavailable',
        })
      }
      renderFlow()
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Some billing routes could not be checked. Retry to see all available routes.'
      )
      expect(screen.queryAllByRole('radio')).toHaveLength(0)
      expect(
        screen.getByRole('button', { name: 'Generate connection details' })
      ).toBeDisabled()

      vi.mocked(getUserGroupModels).mockResolvedValue({
        success: true,
        data: [DEEPSEEK],
      })
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      expect(
        await screen.findByRole('radio', { name: /Value route/ })
      ).toBeVisible()
    }
  )

  it('invalidates the copyable connection when refreshed routing data removes model support', async () => {
    const queryClient = renderFlow()
    await screen.findByRole('radio', { name: /Value route/ })
    fireEvent.click(
      screen.getByRole('button', { name: 'Generate connection details' })
    )
    await screen.findByRole('button', { name: 'Copy everything' })

    vi.mocked(getUserGroupModels).mockResolvedValue({ success: true, data: [] })
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['user-group-models'] })
    })

    expect(screen.queryByRole('button', { name: 'Copy everything' })).toBeNull()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(
      screen.getByRole('button', { name: 'Generate connection details' })
    ).toBeDisabled()
  })

  it('rechecks the route before creating a key and blocks a route disabled since page load', async () => {
    renderFlow()
    await screen.findByRole('radio', { name: /Value route/ })
    vi.mocked(getUserGroupModels).mockResolvedValue({ success: true, data: [] })
    fireEvent.click(
      screen.getByRole('button', { name: 'Generate connection details' })
    )
    await waitFor(() => expect(screen.queryByText('Preparing...')).toBeNull())
    expect(createApiKey).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Copy everything' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Generate connection details' })
    ).toBeDisabled()
  })

  it('does not create an outdated connection when the user switches models during validation', async () => {
    renderFlow()
    await screen.findByRole('radio', { name: /Value route/ })
    let resolveModels!: (
      result: Awaited<ReturnType<typeof getUserGroupModels>>
    ) => void
    vi.mocked(getUserGroupModels).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveModels = resolve
      })
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Generate connection details' })
    )
    chooseModel('gpt-5.6')
    await act(async () => resolveModels({ success: true, data: [DEEPSEEK] }))
    expect(createApiKey).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Copy everything' })).toBeNull()
    expect(screen.getByRole('combobox')).toHaveValue('gpt-5.6')
  })
})
