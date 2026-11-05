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
import { expect, test } from 'vitest'

import { MODEL_PRICES, OFFICIAL_PRICING_URL } from '../../data/model-prices'
import { OfficialPriceLink } from '../official-price-link'

test('every sold model links to an https pricing page of its provider', () => {
  for (const entry of MODEL_PRICES) {
    expect(OFFICIAL_PRICING_URL[entry.provider]).toMatch(/^https:\/\//)
  }
})

test('a sold model shows the provider link and the list price in Turkish', () => {
  render(<OfficialPriceLink model='claude-opus-5-5' language='tr' />)
  const link = screen.getByRole('link', { name: /Resmi fiyat \(Anthropic\)/ })
  expect(link.getAttribute('href')).toBe(OFFICIAL_PRICING_URL.Anthropic)
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  expect(screen.getByTestId('hw-official-price').textContent).toContain(
    '$4 / $20'
  )
})

test('a model without a list price still links and says so in English', () => {
  render(<OfficialPriceLink model='grok-4' language='en' />)
  expect(
    screen.getByRole('link', { name: /Official price \(xAI\)/ })
  ).toBeTruthy()
  expect(screen.getByTestId('hw-official-price').textContent).toContain(
    'no list price'
  )
})

test('a model we do not sell renders nothing', () => {
  const { container } = render(
    <OfficialPriceLink model='unknown-model' language='en' />
  )
  expect(container.firstChild).toBeNull()
})
