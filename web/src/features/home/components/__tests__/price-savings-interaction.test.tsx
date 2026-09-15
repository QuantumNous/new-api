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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { SavingsModel } from '../../lib/pricing-savings'
import { PriceSavings } from '../sections/price-savings'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: ReactNode
    className?: string
    to: string
    params?: { modelId?: string }
  }) => (
    <a
      className={props.className}
      href={
        props.params?.modelId ? `/pricing/${props.params.modelId}` : props.to
      }
    >
      {props.children}
    </a>
  ),
}))

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => <span data-testid='vendor-icon' />,
}))

const models: SavingsModel[] = [
  {
    modelName: 'gpt-flagship',
    vendorName: 'OpenAI',
    family: 'openai',
    baseInputPrice: 4,
    baseOutputPrice: 12,
    baseCacheReadPrice: 0.4,
    baseCacheWritePrice: 5,
    siteInputPrice: 2,
    siteOutputPrice: 6,
    siteCacheReadPrice: 0.2,
    siteCacheWritePrice: 2.5,
    savingsPercent: 50,
  },
  {
    modelName: 'claude-flagship',
    vendorName: 'Anthropic',
    family: 'anthropic',
    baseInputPrice: 3,
    baseOutputPrice: 15,
    baseCacheReadPrice: 0.3,
    baseCacheWritePrice: 3.75,
    siteInputPrice: 1.5,
    siteOutputPrice: 7.5,
    siteCacheReadPrice: 0.15,
    siteCacheWritePrice: 1.875,
    savingsPercent: 50,
  },
]

describe('PriceSavings', () => {
  it('labels catalog rates as a base comparison rather than official prices', () => {
    render(<PriceSavings models={models} />)
    expect(screen.queryAllByText('Official API')).toHaveLength(0)
    expect(
      screen.getAllByText(
        'Compared with site base prices before group discounts, not official provider prices.'
      ).length
    ).toBeGreaterThan(0)
  })

  it('keeps a useful recovery state when live pricing has no usable models', () => {
    render(<PriceSavings models={[]} />)

    expect(screen.getByTestId('savings-unavailable')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Model prices' })).toHaveAttribute(
      'href',
      '/pricing'
    )
  })

  it('provides dedicated desktop table and mobile card layouts', () => {
    render(<PriceSavings models={models} />)

    expect(screen.getByTestId('desktop-price-table')).toHaveClass(
      'hidden',
      'md:grid'
    )
    expect(screen.getByTestId('mobile-price-cards')).toHaveClass('md:hidden')
    expect(screen.getAllByText('gpt-flagship').length).toBeGreaterThan(0)
  })

  it('filters the live catalog by search query', async () => {
    const user = userEvent.setup()
    render(<PriceSavings models={models} calculatorModels={models} />)

    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'claude')

    expect(screen.getAllByText('claude-flagship').length).toBeGreaterThan(0)
    expect(screen.queryByText('gpt-flagship')).not.toBeInTheDocument()
  })

  it('links each catalog row to the model price page', () => {
    render(<PriceSavings models={models} />)

    expect(screen.getByRole('link', { name: /gpt-flagship/i })).toHaveAttribute(
      'href',
      '/pricing/gpt-flagship'
    )
  })
})
