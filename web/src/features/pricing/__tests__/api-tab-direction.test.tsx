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
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { ModelDetailsApi } from '../components/model-details-api'
import type { PricingModel } from '../types'

vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))

const model = {
  model_name: 'gpt-4.1',
  enable_groups: ['default'],
  supported_endpoint_types: ['openai'],
} as unknown as PricingModel

function renderApiTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ModelDetailsApi
        model={model}
        endpointMap={{ openai: { path: '/v1/chat/completions' } }}
      />
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
})

it('aligns the rate limit headers with their numbers at the inline end', () => {
  renderApiTab()

  for (const name of ['RPM', 'TPM', 'RPD']) {
    const header = screen.getByRole('columnheader', { name })
    expect(header).toHaveClass('text-end')
    expect(header).not.toHaveClass('text-right')
  }
})

it('pushes the code language tabs to the inline end', () => {
  renderApiTab()

  const languageTabs = screen
    .getByRole('tab', { name: 'cURL' })
    .closest('[class*="ms-auto"], [class*="ml-auto"]')
  expect(languageTabs).toHaveClass('ms-auto')
  expect(languageTabs).not.toHaveClass('ml-auto')
})
