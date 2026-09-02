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
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createApiKey } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { getUserGroups, getUserModels } from '@/lib/api'

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
}))

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
    model_limits: 'deepseek-v4',
    allow_ips: '',
  }
}

describe('easy connect flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUserModels).mockResolvedValue({
      success: true,
      data: ['deepseek-v4'],
    })
    vi.mocked(getUserGroups).mockResolvedValue({
      success: true,
      data: {
        discount: { desc: 'Value route', ratio: 0.8 },
      },
    })
    vi.mocked(createApiKey).mockResolvedValue({
      success: true,
      data: createdKey(),
    })
  })

  it('creates a model-limited key and copies the three values as one bundle', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <EasyConnectFlow />
      </QueryClientProvider>
    )

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
        model_limits: 'deepseek-v4',
        unlimited_quota: true,
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy everything' }))
    expect(copyToClipboard).toHaveBeenCalledWith(
      [
        'API address: https://api.example.com/v1',
        'API key: sk-new-secret',
        'Model: deepseek-v4',
      ].join('\n')
    )
  })
})
