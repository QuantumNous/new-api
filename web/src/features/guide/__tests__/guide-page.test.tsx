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
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPricing } from '@/features/pricing/api'
import { getUserGroupModels, getUserGroups, getUserModels } from '@/lib/api'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { renderApp } from '@/test-utils/render-app'

import { GuidePage } from '../index'
import type { GuideSearch } from '../types'
import { useGuideAddress } from '../use-guide-address'

vi.mock('@/features/pricing/api', () => ({ getPricing: vi.fn() }))
vi.mock('@/lib/api', () => ({
  getUserModels: vi.fn(),
  getUserGroups: vi.fn(),
  getUserGroupModels: vi.fn(),
}))
vi.mock('@/lib/copy-to-clipboard', () => ({ copyToClipboard: vi.fn() }))
vi.mock('../use-guide-address', () => ({ useGuideAddress: vi.fn() }))

const pricing = {
  success: true,
  data: [
    {
      id: 1,
      model_name: 'responses-model',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 1,
      enable_groups: ['default'],
      supported_endpoint_types: ['openai-response'],
      context_length: 1_000_000,
    },
  ],
  vendors: [],
  group_ratio: {},
  usable_group: {},
  supported_endpoint: {},
  auto_groups: [],
}

let client: QueryClient

function GuideHarness() {
  const [search, setSearch] = useState<GuideSearch>({ platform: 'macos' })
  return (
    <GuidePage
      slug='codex'
      search={search}
      onSearchChange={(next) =>
        setSearch((current) => ({ ...current, ...next }))
      }
    />
  )
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
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
    data: ['responses-model'],
  })
  vi.mocked(getUserGroups).mockResolvedValue({
    success: true,
    data: { default: { desc: 'Standard route', ratio: 1 } },
  })
  vi.mocked(getUserGroupModels).mockResolvedValue({
    success: true,
    data: ['responses-model'],
  })
  vi.mocked(copyToClipboard).mockResolvedValue(true)
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.clearAllMocks()
})

describe('developer guide page', () => {
  it('renders the approved navigation and account-aware Codex configuration', async () => {
    await renderApp(<GuideHarness />, client)

    expect(screen.getByRole('link', { name: 'Quick start' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Claude Code' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Troubleshooting' })).toBeVisible()
    await waitFor(() =>
      expect(screen.getByText('responses-model')).toBeVisible()
    )
    expect(screen.getByText('Standard route')).toBeVisible()
    expect(screen.getByText('https://api.example.test/v1')).toBeVisible()
    expect(screen.getByText(/model = "responses-model"/)).toBeVisible()
  })

  it('switches platform instructions without leaving the article', async () => {
    const user = userEvent.setup()
    await renderApp(<GuideHarness />, client)

    await user.click(screen.getByRole('tab', { name: 'Windows' }))

    expect(screen.getByText('PowerShell session')).toBeVisible()
    expect(screen.getByText(/\$env:YECAI_API_KEY/)).toBeVisible()
  })

  it('copies the resolved visible configuration without a real key', async () => {
    const user = userEvent.setup()
    await renderApp(<GuideHarness />, client)
    const copyButton = await screen.findByRole('button', {
      name: 'Copy Codex config',
    })

    await user.click(copyButton)

    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('base_url = "https://api.example.test/v1"')
    )
    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('model = "responses-model"')
    )
    expect(copyToClipboard).not.toHaveBeenCalledWith(
      expect.stringContaining('real-secret')
    )
  })

  it('finds an error article from translated document content', async () => {
    const user = userEvent.setup()
    await renderApp(<GuideHarness />, client)

    const search = screen.getByRole('searchbox', {
      name: 'Search documentation',
    })
    await user.type(search, '404')

    expect(screen.getByRole('link', { name: /Troubleshooting/ })).toBeVisible()
  })

  it('provides a titled mobile navigation sheet', async () => {
    const user = userEvent.setup()
    await renderApp(<GuideHarness />, client)

    await user.click(
      screen.getByRole('button', { name: 'Open documentation navigation' })
    )

    expect(screen.getByRole('dialog', { name: 'Documentation' })).toBeVisible()
  })

  it('enables the table of contents at the desktop xl breakpoint', async () => {
    await renderApp(<GuideHarness />, client)

    expect(screen.getByTestId('guide-layout')).toHaveClass(
      'xl:grid-cols-[15rem_minmax(0,1fr)_13rem]'
    )
    expect(screen.getByTestId('guide-toc')).toHaveClass('xl:block')
  })

  it('shows an honest empty state when no Responses model is available', async () => {
    vi.mocked(getUserModels).mockResolvedValue({
      success: true,
      data: [],
    })
    await renderApp(<GuideHarness />, client)

    expect(
      await screen.findByText('No compatible models are available')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open Models' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Copy Codex config' })
    ).toBeDisabled()
  })
})
