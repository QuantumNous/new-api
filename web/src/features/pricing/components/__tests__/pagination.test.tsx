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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, test, vi } from 'vitest'

import type { PerfSummaryAllData } from '@/features/performance-metrics/types'

import type { PricingModel } from '../../types'
import { ModelCardGrid } from '../model-card-grid'

// @lobehub/icons transitively imports @emoji-mart JSON assets that vitest's
// externalized ESM loader rejects. Icon rendering is irrelevant to the
// pagination contracts under test, so the icon loader boundary is stubbed.
vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
}))

// The perf summary endpoint is a network boundary the grid queries on mount;
// perf badges are irrelevant to pagination behavior.
vi.mock('@/features/performance-metrics/api', () => ({
  getPerfMetricsSummary: vi.fn(
    async (): Promise<PerfSummaryAllData> => ({
      success: true,
      data: { models: [] },
    })
  ),
}))

// The grid paginates 20 models per page (DEFAULT_PRICING_PAGE_SIZE).
function makeModels(count: number): PricingModel[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    model_name: `model-${String(index + 1).padStart(3, '0')}`,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 2,
    enable_groups: ['default'],
  }))
}

// A test-local i18next instance keeps the shared singleton untouched; the
// three keys are the only copy the pagination assertions rely on.
function createTestI18n() {
  const instance = i18next.createInstance()
  void instance.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          'Page {{current}} of {{total}}': 'Page {{current}} of {{total}}',
          'Previous page': 'Previous page',
          'Next page': 'Next page',
        },
      },
    },
  })
  return instance
}

function GridHarness({ models }: { models: PricingModel[] }) {
  const [queryClient] = useState(() => new QueryClient())
  const [i18n] = useState(createTestI18n)
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ModelCardGrid models={models} onModelClick={() => {}} />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

describe('ModelCardGrid pagination', () => {
  test('given the filtered list shrinks below the current page, the grid returns to page 1 of the new list', async () => {
    const user = userEvent.setup()
    const view = render(<GridHarness models={makeModels(100)} />)

    const nextButton = await screen.findByRole('button', { name: 'Next page' })
    for (let i = 0; i < 4; i += 1) {
      await user.click(nextButton)
    }
    expect(screen.getByText('Page 5 of 5')).toBeInTheDocument()

    view.rerender(<GridHarness models={makeModels(45)} />)

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByText('model-001')).toBeInTheDocument()
    expect(screen.queryByText('model-021')).not.toBeInTheDocument()
  })

  test('given a shrunken list, previous and next navigate within the new page range', async () => {
    const user = userEvent.setup()
    const view = render(<GridHarness models={makeModels(100)} />)

    const nextButton = await screen.findByRole('button', { name: 'Next page' })
    for (let i = 0; i < 4; i += 1) {
      await user.click(nextButton)
    }
    view.rerender(<GridHarness models={makeModels(45)} />)

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('model-021')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  })

  test('given a single-page list, the pagination footer is not rendered', () => {
    render(<GridHarness models={makeModels(20)} />)

    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Next page' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('model-001')).toBeInTheDocument()
  })
})
