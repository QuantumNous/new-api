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
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BillingExpressionDisclosure } from '../components/billing-expression-disclosure'
import { DynamicPricingBreakdown } from '../components/dynamic-pricing-breakdown'
import { ModelDetailsContent } from '../components/model-details'
import type { PricingModel } from '../types'

vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))

const clients: QueryClient[] = []
afterEach(() => {
  for (const client of clients.splice(0)) client.clear()
})

const expression = 'tier("standard", (p * 12 + c * 36) / 7.3)'

describe('raw billing expression disclosure', () => {
  it('hides unsupported expression source until the reader expands it', async () => {
    const user = userEvent.setup()
    render(<DynamicPricingBreakdown billingExpr={expression} />)

    expect(screen.getByText('Special billing expression')).toBeVisible()
    expect(screen.queryByText(expression)).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Raw expression' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(expression)).toBeVisible()
    await user.keyboard('{Enter}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(expression)).not.toBeInTheDocument()
  })

  it('keeps recognized pricing tables visible without an expression disclosure', () => {
    render(
      <DynamicPricingBreakdown billingExpr='tier("standard", p * 2 + c * 8)' />
    )
    expect(screen.getByRole('table')).toBeVisible()
    expect(screen.getAllByText('$2.0000')[0]).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Raw expression' })
    ).not.toBeInTheDocument()
  })

  it('collapses the formula again when switching to a different expression', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <BillingExpressionDisclosure expression={expression} />
    )
    await user.click(screen.getByRole('button', { name: 'Raw expression' }))
    expect(screen.getByText(expression)).toBeVisible()

    rerender(
      <BillingExpressionDisclosure expression='tier("other", p / 7.3)' />
    )
    expect(
      screen.getByRole('button', { name: 'Raw expression' })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('tier("other", p / 7.3)')).not.toBeInTheDocument()
  })

  it('keeps Qwen model descriptions visible while all detail fallback formulas start collapsed', async () => {
    const user = userEvent.setup()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    clients.push(client)
    const description = 'Prices depend on input length and thinking mode.'
    const qwenExpression =
      'tier("standard", (p * 0.8 + c * (param("enable_thinking") == true ? 8 : 2)) / 7.3)'
    const model: PricingModel = {
      id: 1,
      model_name: 'qwen-plus',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 1,
      enable_groups: ['default'],
      billing_mode: 'tiered_expr',
      billing_expr: qwenExpression,
      description,
    }
    render(
      <QueryClientProvider client={client}>
        <ModelDetailsContent
          model={model}
          groupRatio={{ default: 1 }}
          usableGroup={{ default: { desc: '', ratio: 1 } }}
          endpointMap={{}}
          autoGroups={[]}
          priceRate={1}
          usdExchangeRate={1}
          tokenUnit='M'
        />
      </QueryClientProvider>
    )
    expect(screen.getByText(description)).toBeVisible()
    expect(screen.queryByText(qwenExpression)).not.toBeInTheDocument()
    const disclosures = screen.getAllByRole('button', {
      name: 'Raw expression',
    })
    expect(disclosures).toHaveLength(3)
    for (const disclosure of disclosures) {
      expect(disclosure).toHaveAttribute('aria-expanded', 'false')
      await user.click(disclosure)
      expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    }
    expect(screen.getAllByText(qwenExpression)).toHaveLength(3)
  })
})
