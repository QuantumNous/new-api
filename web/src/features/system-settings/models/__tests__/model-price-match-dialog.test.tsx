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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import { fetchUpstreamRatios } from '../../api'
import { ModelPriceMatchDialog } from '../model-price-match-dialog'

vi.mock('../../api', () => ({
  fetchUpstreamRatios: vi.fn(),
}))

describe('model price match dialog', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
      configurable: true,
      value: () => [],
    })
    i18next.addResourceBundle('en', 'translation', {
      'Apply selected price': 'Apply selected price',
      'Choose a matching price': 'Choose a matching price',
      'Fuzzy match': 'Fuzzy match',
      'Normalized match': 'Normalized match',
      'Possible price matches': 'Possible price matches',
    })
  })

  afterAll(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('lets the user choose one candidate before applying its price', async () => {
    vi.mocked(fetchUpstreamRatios).mockResolvedValue({
      success: true,
      message: '',
      data: {
        test_results: [],
        differences: {
          'z-ai/glm-5.3': {
            model_ratio: {
              current: null,
              upstreams: { openrouter: 0.7 },
              confidence: { openrouter: true },
            },
            completion_ratio: {
              current: null,
              upstreams: { openrouter: 3.142857 },
              confidence: { openrouter: true },
            },
          },
          'z-ai/glm-5.2': {
            model_ratio: {
              current: null,
              upstreams: { openrouter: 0.483 },
              confidence: { openrouter: true },
            },
          },
        },
      },
    })
    const onApply = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <ModelPriceMatchDialog
          modelName='glm-5.3'
          open
          onOpenChange={() => undefined}
          onApply={onApply}
        />
      </QueryClientProvider>
    )

    const fuzzyChoice = await screen.findByRole('radio', {
      name: /z-ai\/glm-5\.2/,
    })
    expect(screen.getByRole('radio', { name: /z-ai\/glm-5\.3/ })).toBeChecked()

    await user.click(fuzzyChoice)
    await user.click(
      screen.getByRole('button', { name: 'Apply selected price' })
    )

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceModel: 'z-ai/glm-5.2',
        kind: 'fuzzy',
        ratio: 0.483,
      })
    )
    queryClient.clear()
  })

  test('stays open when applying the selected price does not save', async () => {
    vi.mocked(fetchUpstreamRatios).mockResolvedValue({
      success: true,
      message: '',
      data: {
        test_results: [],
        differences: {
          'z-ai/glm-5.3': {
            model_ratio: {
              current: null,
              upstreams: { openrouter: 0.7 },
              confidence: { openrouter: true },
            },
          },
        },
      },
    })
    const onOpenChange = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <ModelPriceMatchDialog
          modelName='glm-5.3'
          open
          onOpenChange={onOpenChange}
          onApply={async () => false}
        />
      </QueryClientProvider>
    )

    await screen.findByRole('radio', { name: /z-ai\/glm-5\.3/ })
    await user.click(
      screen.getByRole('button', { name: 'Apply selected price' })
    )

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeVisible()
    queryClient.clear()
  })
})
