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
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'
import { pricingCards } from './content.ts'

const lowerSectionsCssPath = fileURLToPath(new URL('./static-home-lower-sections.css', import.meta.url))
const lowerSectionsCss = readFileSync(lowerSectionsCssPath, 'utf8')

const pricingCtaBaseClass = 'static-home__pricing-cta'

const pricingCardClassNames = pricingCards.map((card) => {
  const isFeatured = 'featured' in card && card.featured === true
  const toneClass = 'priceTone' in card && card.priceTone === 'neutral'
    ? 'static-home__pricing-price--neutral'
    : 'static-home__pricing-price--accent'

  return {
    ctaClassName: `${pricingCtaBaseClass} ${isFeatured ? 'static-home__pricing-cta--solid' : 'static-home__pricing-cta--ghost'}`,
    listClassName: 'static-home__pricing-feature-list',
    priceClassName: 'priceVariant' in card && card.priceVariant === 'split'
      ? 'static-home__pricing-price static-home__pricing-price--split static-home__pricing-price--accent'
      : `static-home__pricing-price static-home__pricing-price--text ${toneClass}`,
  }
})

describe('static home pricing parity', () => {
  test('maps pricing cards to the same structural classes as the HTML prototype', () => {
    assert.deepEqual(pricingCardClassNames, [
      {
        ctaClassName: 'static-home__pricing-cta static-home__pricing-cta--solid',
        listClassName: 'static-home__pricing-feature-list',
        priceClassName: 'static-home__pricing-price static-home__pricing-price--split static-home__pricing-price--accent',
      },
      {
        ctaClassName: 'static-home__pricing-cta static-home__pricing-cta--ghost',
        listClassName: 'static-home__pricing-feature-list',
        priceClassName: 'static-home__pricing-price static-home__pricing-price--text static-home__pricing-price--neutral',
      },
      {
        ctaClassName: 'static-home__pricing-cta static-home__pricing-cta--ghost',
        listClassName: 'static-home__pricing-feature-list',
        priceClassName: 'static-home__pricing-price static-home__pricing-price--text static-home__pricing-price--neutral',
      },
    ])
  })

  test('keeps the HTML prototype pricing visual contract in CSS', () => {
    assert.match(lowerSectionsCss, /\.static-home__pricing-badge\s*\{[^}]*position:\s*absolute;/s)
    assert.match(lowerSectionsCss, /\.static-home__pricing-feature-list\s*\{[^}]*list-style:\s*none;/s)
    assert.match(lowerSectionsCss, /\.static-home__pricing-feature-list li::before\s*\{[^}]*transform:\s*rotate\(-45deg\);/s)
    assert.match(lowerSectionsCss, /\.static-home__pricing-cta--solid\s*\{[^}]*background:\s*linear-gradient/s)
    assert.match(lowerSectionsCss, /\.static-home__pricing-cta--ghost\s*\{[^}]*background:/s)
  })
})
