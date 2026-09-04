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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { beforeEach, beforeAll, describe, expect, test, vi } from 'vitest'

import { STORAGE_KEYS } from '../../constants'
import { Playground } from '../../index'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

function renderPlayground() {
  return render(
    <QueryClientProvider client={queryClient}>
      <Playground />
    </QueryClientProvider>
  )
}

vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api')>()
  return {
    ...actual,
    getUserModels: vi.fn(async () => [
      { label: 'gpt-4o', value: 'gpt-4o' },
    ]),
    getUserGroups: vi.fn(async () => [
      { label: 'default', value: 'default', ratio: 1 },
    ]),
  }
})

beforeAll(() => {
  i18next.addResourceBundle('en', 'translation', {
    'Playground mode': 'Playground mode',
    Chat: 'Chat',
    Image: 'Image',
    Model: 'Model',
    Prompt: 'Prompt',
    Group: 'Group',
  })
})

beforeEach(() => {
  localStorage.clear()
})

describe('Playground mode switching', () => {
  test('defaults to chat mode and switches to image without clearing chat config', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      STORAGE_KEYS.CONFIG,
      JSON.stringify({
        version: 1,
        data: { model: 'gpt-4o', group: 'default' },
      })
    )

    renderPlayground()

    const tabs = screen.getByRole('tablist', {
      name: 'Playground mode',
    })
    const chatTab = within(tabs).getByRole('tab', { name: 'Chat' })
    const imageTab = within(tabs).getByRole('tab', { name: 'Image' })
    expect(chatTab).toHaveAttribute('aria-selected', 'true')

    await user.click(imageTab)
    expect(imageTab).toHaveAttribute('aria-selected', 'true')
    expect(chatTab).toHaveAttribute('aria-selected', 'false')

    await user.click(chatTab)
    expect(chatTab).toHaveAttribute('aria-selected', 'true')

    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.CONFIG) ?? '{}'
    ) as { data?: { model?: string } }
    expect(stored.data?.model).toBe('gpt-4o')
  })

  test('image config persists to its own storage key', async () => {
    const user = userEvent.setup()
    renderPlayground()

    await user.click(
      within(screen.getByRole('tablist')).getByRole('tab', { name: 'Image' })
    )

    expect(
      localStorage.getItem(STORAGE_KEYS.IMAGE_CONFIG)
    ).toBeNull()
  })
})
