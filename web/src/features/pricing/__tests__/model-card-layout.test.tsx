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
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LoadingSkeleton } from '../components/loading-skeleton'
import { ModelCard } from '../components/model-card'
import { ModelCardGrid } from '../components/model-card-grid'
import type { PricingModel } from '../types'

const { copyToClipboard } = vi.hoisted(() => ({
  copyToClipboard: vi.fn(),
}))

vi.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard }),
}))

vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))

vi.mock('@/features/performance-metrics/api', () => ({
  getPerfMetricsSummary: async () => ({ data: { models: [] } }),
}))

const model: PricingModel = {
  id: 1,
  model_name: 'claude-opus-4-6-with-a-long-provider-model-identifier',
  description: 'Nexos AI via CPA · Anthropic',
  quota_type: 0,
  model_ratio: 0.5,
  completion_ratio: 5,
  cache_ratio: 0.1,
  enable_groups: ['opencode-go-with-a-long-route-name'],
  supported_endpoint_types: ['openai-response'],
  tags: 'nexos,cpa',
}

const perf = { avg_latency_ms: 1000, avg_tps: 7, success_rate: 99 }

function requireElement(element: Element | null | undefined): HTMLElement {
  if (!(element instanceof HTMLElement)) {
    throw new Error('Expected a rendered card section')
  }
  return element
}

function renderGrid(models = [model]) {
  const onModelClick = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ModelCardGrid models={models} onModelClick={onModelClick} />
    </QueryClientProvider>
  )
  return onModelClick
}

describe('readable model cards', () => {
  it('gives the full model identifier a wrapping header without price or action competition', () => {
    render(<ModelCard model={model} onClick={vi.fn()} />)
    const title = screen.getByRole('heading', { name: model.model_name })
    expect(title).not.toHaveClass('truncate')
    expect(title).toHaveClass('[overflow-wrap:anywhere]')
    const header = requireElement(title.closest('header'))
    expect(within(header).queryAllByRole('button')).toHaveLength(0)
    expect(within(header).queryByText('Input')).toBeNull()
    expect(screen.getByText('Input')).toBeVisible()
    expect(screen.getByText('Output')).toBeVisible()
    expect(screen.getByText('Cached')).toBeVisible()
  })

  it('keeps long route names and billing labels out of the performance and actions row', () => {
    render(<ModelCard model={model} perf={perf} onClick={vi.fn()} />)
    const route = screen.getByText(model.enable_groups[0])
    expect(route).toHaveClass('[overflow-wrap:anywhere]')
    expect(route).not.toHaveClass('truncate')
    const metadata = requireElement(
      route.closest('[data-slot="model-metadata"]')
    )
    expect(within(metadata).getByText('Token-based')).toBeVisible()
    expect(
      within(metadata)
        .getByText('Token-based')
        .closest('[data-slot="status-badge"]')
    ).toHaveClass('shrink-0', 'whitespace-normal')
    expect(within(metadata).queryByText('Latency short')).toBeNull()
    const footer = requireElement(
      screen.getByRole('article').querySelector('footer')
    )
    expect(footer).toHaveClass('flex-wrap')
    expect(within(footer).getByText('Latency short')).toBeVisible()
    expect(
      within(footer).getByRole('button', { name: 'Details' })
    ).toBeVisible()
    expect(
      within(footer).getByText('Latency short').parentElement?.parentElement
    ).toHaveClass('grid', 'shrink-0')
  })

  it('copies the full name and opens details for the correct model', () => {
    const onModelClick = renderGrid()
    fireEvent.click(screen.getByRole('button', { name: 'Copy model name' }))
    expect(copyToClipboard).toHaveBeenCalledWith(model.model_name)
    expect(onModelClick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(onModelClick).toHaveBeenCalledWith(model.model_name)
  })

  it('sizes columns from the available container width and allows a column narrower than 20rem on phones', () => {
    renderGrid()
    const grid = requireElement(screen.getByRole('article').parentElement)
    // The min(100%, 20rem) floor is container-relative, not a viewport breakpoint.
    expect(grid).toHaveClass(
      'grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]'
    )
    expect(grid).not.toHaveClass('lg:grid-cols-3', 'md:grid-cols-2')
  })

  it('uses the same container-sized column contract while loading', () => {
    const { container } = render(<LoadingSkeleton />)
    expect(
      [...container.querySelectorAll('.grid')].filter((grid) =>
        grid.classList.contains(
          'grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]'
        )
      )
    ).toHaveLength(1)
    expect(
      container.querySelectorAll('[class~="lg:grid-cols-3"]')
    ).toHaveLength(0)
  })

  it('keeps per-request models actionable without a performance sample', () => {
    render(
      <ModelCard
        model={{ ...model, quota_type: 1, model_price: 0.25 }}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('Per Request')).toBeVisible()
    expect(screen.queryByText('Latency short')).toBeNull()
    expect(screen.getByRole('button', { name: 'Details' })).toBeVisible()
    expect(screen.queryByText('Cached')).toBeNull()
  })
})
