/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGuideAddress } from '@/features/guide/use-guide-address'
import { renderApp } from '@/test-utils/render-app'

import { BeginnerGuidePage } from '../index'

vi.mock('@/features/guide/use-guide-address', () => ({
  useGuideAddress: vi.fn(),
}))

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  vi.mocked(useGuideAddress).mockReturnValue({
    host: 'https://api.example.test',
    baseUrl: 'https://api.example.test/v1',
    fullUrl: 'https://api.example.test/v1/chat/completions',
    fill: (text) =>
      text
        .replaceAll('{{HOST}}', 'https://api.example.test')
        .replaceAll('{{BASE_URL}}', 'https://api.example.test/v1')
        .replaceAll(
          '{{FULL_URL}}',
          'https://api.example.test/v1/chat/completions'
        ),
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.clearAllMocks()
})

describe('beginner guide page', () => {
  it('renders the historical guide and opens a requested tool without exposing a key', async () => {
    await renderApp(
      <BeginnerGuidePage query='workbuddy' toolId='workbuddy' />,
      client
    )

    expect(
      screen.getByRole('heading', { name: 'Beginner guide', hidden: true })
    ).toBeVisible()
    expect(screen.getByText('https://api.example.test/v1')).toBeVisible()
    expect(screen.getByText('sk-****************')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: /WorkBuddy \/ CodeBuddy/ })
    ).toBeVisible()
    expect(screen.queryByText('real-secret')).not.toBeInTheDocument()
  })

  it('keeps the tool catalog usable when a requested tool is unknown', async () => {
    await renderApp(<BeginnerGuidePage toolId='missing-tool' />, client)
    const tools = document.querySelector('#tools') as HTMLElement

    expect(
      within(tools).getByRole('button', { name: /WorkBuddy \/ CodeBuddy/ })
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('narrows the tool wall from a use-case card and restores it on clear', async () => {
    const user = userEvent.setup()
    await renderApp(<BeginnerGuidePage />, client)
    const tools = document.querySelector('#tools') as HTMLElement

    expect(
      within(tools).getByRole('button', { name: /WorkBuddy \/ CodeBuddy/ })
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: /Write code in the terminal/ })
    )

    expect(
      within(tools).queryByRole('button', { name: /WorkBuddy \/ CodeBuddy/ })
    ).not.toBeInTheDocument()
    expect(
      within(tools).getByRole('button', { name: /Claude Code/ })
    ).toBeVisible()

    await user.click(
      within(tools).getByRole('button', { name: 'Clear filters' })
    )

    expect(
      within(tools).getByRole('button', { name: /WorkBuddy \/ CodeBuddy/ })
    ).toBeVisible()
  })
})
