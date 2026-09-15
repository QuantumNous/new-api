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
import { act, renderHook, waitFor } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPricing } from '@/features/pricing/api'
import { getUserGroupModels, getUserGroups, getUserModels } from '@/lib/api'

import { useGuideEnvironment } from '../hooks/use-guide-environment'
import { useGuideAddress } from '../use-guide-address'

vi.mock('@/features/pricing/api', () => ({ getPricing: vi.fn() }))
vi.mock('@/lib/api', () => ({
  getUserModels: vi.fn(),
  getUserGroups: vi.fn(),
  getUserGroupModels: vi.fn(),
}))
vi.mock('../use-guide-address', () => ({ useGuideAddress: vi.fn() }))

const pricing = {
  success: true,
  data: [
    {
      id: 1,
      model_name: 'chat-model',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 1,
      enable_groups: ['vip'],
      supported_endpoint_types: ['openai'],
    },
    {
      id: 2,
      model_name: 'responses-model',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 1,
      enable_groups: ['default'],
      supported_endpoint_types: ['openai-response'],
      context_length: 1_000_000,
    },
    {
      id: 3,
      model_name: 'responses-model-2',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 1,
      enable_groups: ['vip'],
      supported_endpoint_types: ['openai-response'],
    },
  ],
  vendors: [],
  group_ratio: {},
  usable_group: {},
  supported_endpoint: {},
  auto_groups: [],
}

let client: QueryClient

function wrapper(props: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>{props.children}</QueryClientProvider>
  )
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  })
  vi.mocked(useGuideAddress).mockReturnValue({
    host: 'https://api.example.test',
    baseUrl: 'https://api.example.test/v1',
    fullUrl: 'https://api.example.test/v1/chat/completions',
    fill: (text) => text,
  })
  vi.mocked(getPricing).mockResolvedValue(pricing)
  vi.mocked(getUserModels).mockResolvedValue({
    success: true,
    data: ['chat-model', 'responses-model-2', 'responses-model'],
  })
  vi.mocked(getUserGroups).mockResolvedValue({
    success: true,
    data: {
      default: { desc: 'Standard', ratio: 1 },
      vip: { desc: 'VIP', ratio: 2 },
    },
  })
  vi.mocked(getUserGroupModels).mockImplementation(async (group) => ({
    success: true,
    data:
      group === 'default'
        ? ['responses-model']
        : ['chat-model', 'responses-model-2'],
  }))
})

afterEach(() => {
  client.clear()
  vi.clearAllMocks()
})

describe('useGuideEnvironment', () => {
  it('shows only account models and groups compatible with the article protocol', async () => {
    const { result } = renderHook(
      () =>
        useGuideEnvironment('openai-response', { platform: 'macos' }, vi.fn()),
      { wrapper }
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.models.map((item) => item.value)).toEqual([
      'responses-model',
      'responses-model-2',
    ])
    expect(result.current.groups).toEqual([
      { value: 'default', label: 'Standard' },
    ])
    expect(result.current.runtime).toMatchObject({
      baseUrl: 'https://api.example.test/v1',
      model: 'responses-model',
      group: 'default',
      contextLength: 1_000_000,
    })
  })

  it('replaces invalid requested values with a compatible deterministic default', async () => {
    const { result } = renderHook(
      () =>
        useGuideEnvironment(
          'openai-response',
          { model: 'missing', group: 'vip', platform: 'windows' },
          vi.fn()
        ),
      { wrapper }
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.runtime).toMatchObject({
      model: 'responses-model',
      group: 'default',
      platform: 'windows',
    })
  })

  it('updates the group when the user chooses a model on another route', async () => {
    function useHarness() {
      const [requested, setRequested] = useState({
        model: 'responses-model',
        group: 'default',
        platform: 'macos' as const,
      })
      return useGuideEnvironment('openai-response', requested, (selection) =>
        setRequested((current) => ({ ...current, ...selection }))
      )
    }

    const { result } = renderHook(useHarness, { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.setModel('responses-model-2'))

    await waitFor(() =>
      expect(result.current.runtime).toMatchObject({
        model: 'responses-model-2',
        group: 'vip',
      })
    )
  })

  it('reports an honest empty state when no account model supports the protocol', async () => {
    vi.mocked(getUserModels).mockResolvedValue({
      success: true,
      data: ['chat-model'],
    })

    const { result } = renderHook(
      () => useGuideEnvironment('anthropic', { platform: 'linux' }, vi.fn()),
      { wrapper }
    )

    await waitFor(() => expect(result.current.status).toBe('empty'))
    expect(result.current.models).toEqual([])
    expect(result.current.groups).toEqual([])
  })

  it('reports a retryable error when environment data cannot be verified', async () => {
    vi.mocked(getPricing).mockRejectedValue(new Error('offline'))

    const { result } = renderHook(
      () => useGuideEnvironment('all', { platform: 'macos' }, vi.fn()),
      { wrapper }
    )

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.retry).toEqual(expect.any(Function))
  })

  it('handles an unsuccessful pricing response without a data payload', async () => {
    vi.mocked(getPricing).mockResolvedValue({
      success: false,
      message: 'unavailable',
    } as Awaited<ReturnType<typeof getPricing>>)

    const { result } = renderHook(
      () => useGuideEnvironment('all', { platform: 'macos' }, vi.fn()),
      { wrapper }
    )

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.runtime).toMatchObject({
      model: '<model>',
      group: '<group>',
      verified: false,
    })
  })

  it.each([
    { success: true },
    { success: true, data: {} },
    { success: true, data: null },
    { success: true, data: 'invalid' },
    { success: true, data: 7 },
    { success: true, data: false },
  ])(
    'treats a successful pricing response without an array payload as an error',
    async (response) => {
      vi.mocked(getPricing).mockResolvedValue(
        response as Awaited<ReturnType<typeof getPricing>>
      )

      const { result } = renderHook(
        () => useGuideEnvironment('all', { platform: 'macos' }, vi.fn()),
        { wrapper }
      )

      await waitFor(() => expect(result.current.status).toBe('error'))
      expect(result.current.runtime).toMatchObject({
        model: '<model>',
        group: '<group>',
        verified: false,
      })
      expect(result.current.retry).toEqual(expect.any(Function))
    }
  )
})
