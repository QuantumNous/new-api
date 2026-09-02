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
  Link: (props: { children: ReactNode; className?: string; to: string }) => (
    <a className={props.className} href={props.to}>
      {props.children}
    </a>
  ),
}))

const models: SavingsModel[] = [
  {
    modelName: 'gpt-flagship',
    vendorName: 'OpenAI',
    family: 'openai',
    officialInputPrice: 4,
    officialOutputPrice: 12,
    officialCacheReadPrice: 0.4,
    officialCacheWritePrice: 5,
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
    officialInputPrice: 3,
    officialOutputPrice: 15,
    officialCacheReadPrice: 0.3,
    officialCacheWritePrice: 3.75,
    siteInputPrice: 1.5,
    siteOutputPrice: 7.5,
    siteCacheReadPrice: 0.15,
    siteCacheWritePrice: 1.875,
    savingsPercent: 50,
  },
]

describe('PriceSavings', () => {
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
      'md:block'
    )
    expect(screen.getByTestId('mobile-price-cards')).toHaveClass('md:hidden')
    expect(screen.getAllByText('gpt-flagship')).toHaveLength(2)
  })

  it('exposes workload choices as an accessible single-selection control', async () => {
    const user = userEvent.setup()
    render(<PriceSavings models={models} />)

    const coding = screen.getByRole('radio', { name: 'AI coding' })
    const support = screen.getByRole('radio', {
      name: 'Customer support and operations',
    })
    expect(coding).toHaveAttribute('aria-checked', 'true')
    expect(support).toHaveAttribute('aria-checked', 'false')

    await user.click(support)

    expect(coding).toHaveAttribute('aria-checked', 'false')
    expect(support).toHaveAttribute('aria-checked', 'true')
  })

  it('selects a model from the live calculator catalog', async () => {
    const user = userEvent.setup()
    render(<PriceSavings models={[models[0]]} calculatorModels={models} />)

    const modelPicker = screen.getByRole('combobox', { name: 'Model' })
    expect(modelPicker).toHaveValue('gpt-flagship · OpenAI')
    const firstEstimate = screen.getByTestId('annual-savings').textContent

    await user.click(modelPicker)
    await user.type(modelPicker, 'claude')
    await user.click(
      screen.getByRole('option', { name: /claude-flagship · Anthropic/i })
    )

    expect(modelPicker).toHaveValue('claude-flagship · Anthropic')
    expect(screen.getByTestId('annual-savings').textContent).not.toBe(
      firstEstimate
    )
  })

  it('shows cache pricing and the editable token composition', () => {
    render(<PriceSavings models={models} />)

    expect(screen.getAllByText('Cache Read')).not.toHaveLength(0)
    expect(screen.getAllByText('Cache Write')).not.toHaveLength(0)
    expect(screen.getAllByText('55%')).not.toHaveLength(0)
    expect(screen.getAllByText('10%')).not.toHaveLength(0)
    expect(
      document.querySelector<HTMLInputElement>(
        'input[type="range"][aria-label="Cache Read"]'
      )
    ).not.toBeNull()
  })

  it('updates both sliders from the keyboard with meaningful value text', async () => {
    const user = userEvent.setup()
    render(<PriceSavings models={models} />)

    const tokens = document.querySelector<HTMLInputElement>(
      'input[type="range"][aria-label="Monthly tokens"]'
    )
    const people = document.querySelector<HTMLInputElement>(
      'input[type="range"][aria-label="People"]'
    )
    expect(tokens).not.toBeNull()
    expect(people).not.toBeNull()

    tokens?.focus()
    await user.keyboard('{End}')
    expect(tokens).toHaveAttribute('aria-valuetext', '200M tokens')
    expect(screen.getAllByText('200M tokens')).toHaveLength(2)

    people?.focus()
    await user.keyboard('{Home}')
    expect(people).toHaveAttribute('aria-valuetext', '1 people')
    expect(screen.getByText('1 people')).toBeInTheDocument()
  })
})
