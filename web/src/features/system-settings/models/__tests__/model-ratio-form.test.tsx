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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { getEnabledModels } from '@/features/channels/api'

import { fetchUpstreamRatios } from '../../api'
import { ModelRatioForm } from '../model-ratio-form'

vi.mock('@/features/channels/api', () => ({
  getEnabledModels: vi.fn(),
}))

vi.mock('../../api', () => ({
  fetchUpstreamRatios: vi.fn(),
}))

const initialValues = {
  ModelPrice: '{}',
  ModelRatio: '{"existing-model":0.5}',
  CacheRatio: '{"existing-model":0.5}',
  CreateCacheRatio: '{}',
  CompletionRatio: '{"existing-model":2}',
  ImageRatio: '{}',
  AudioRatio: '{}',
  AudioCompletionRatio: '{}',
  ExposeRatioEnabled: false,
  BillingMode: '{}',
  BillingExpr: '{}',
}

function TestForm(props: {
  onSave: (values: typeof initialValues) => Promise<void>
}): ReactNode {
  const form = useForm({ defaultValues: initialValues })
  return (
    <ModelRatioForm
      form={form}
      savedValues={initialValues}
      onSave={props.onSave}
      onReset={() => undefined}
      isSaving={false}
      isResetting={false}
      variant='unset'
    />
  )
}

describe('model ratio form', () => {
  const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'getAnimations'
  )

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
      configurable: true,
      value: () => [],
    })
  })

  afterAll(() => {
    if (getAnimationsDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'getAnimations',
        getAnimationsDescriptor
      )
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
    }
  })

  test('saves an applied price without committing a stale open editor', async () => {
    vi.mocked(getEnabledModels).mockResolvedValue({
      success: true,
      data: ['glm-5.3'],
    })
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
              upstreams: { openrouter: 3 },
              confidence: { openrouter: true },
            },
            cache_ratio: {
              current: null,
              upstreams: { openrouter: 0.1 },
              confidence: { openrouter: true },
            },
          },
        },
      },
    })
    const onSave = vi.fn(async (_values: typeof initialValues) => undefined)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    const user = userEvent.setup()
    const visibilityKey = 'model-ratio-column-visibility'
    const savedVisibility = localStorage.getItem(visibilityKey)
    localStorage.removeItem(visibilityKey)
    const view = render(
      <QueryClientProvider client={queryClient}>
        <TestForm onSave={onSave} />
      </QueryClientProvider>
    )

    try {
      await user.click(await screen.findByText('glm-5.3', { exact: true }))
      const draftPrice = screen.getByPlaceholderText('3')
      await user.type(draftPrice, '9.9')
      expect(draftPrice).toHaveValue('9.9')

      await user.click(screen.getByRole('button', { name: 'Open menu' }))
      await user.click(
        screen.getByRole('menuitem', { name: 'Find matching prices' })
      )
      expect(
        await screen.findByRole('radio', { name: /z-ai\/glm-5\.3/ })
      ).toBeChecked()
      await user.click(
        screen.getByRole('button', { name: 'Apply selected price' })
      )

      await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
      const submitted = onSave.mock.calls[0][0]
      expect(JSON.parse(submitted.ModelRatio)).toEqual({
        'existing-model': 0.5,
        'glm-5.3': 0.7,
      })
      expect(JSON.parse(submitted.CompletionRatio)).toEqual({
        'existing-model': 2,
        'glm-5.3': 3,
      })
      expect(JSON.parse(submitted.CacheRatio)).toEqual({
        'existing-model': 0.5,
        'glm-5.3': 0.1,
      })
    } finally {
      view.unmount()
      queryClient.clear()
      if (savedVisibility === null) {
        localStorage.removeItem(visibilityKey)
      } else {
        localStorage.setItem(visibilityKey, savedVisibility)
      }
    }
  })
})
