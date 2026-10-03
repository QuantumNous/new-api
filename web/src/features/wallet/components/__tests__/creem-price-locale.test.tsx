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
import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'

import { formatCreemPrice } from '../../lib/format'
import type { CreemProduct } from '../../types'
import { CreemProductsSection } from '../creem-products-section'
import { CreemConfirmDialog } from '../dialogs/creem-confirm-dialog'

const product: CreemProduct = {
  name: 'Starter',
  productId: 'prod_1',
  price: 9.9,
  quota: 100_000,
  currency: 'USD',
}

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('Creem product price', () => {
  it.each([
    { language: 'English', lng: 'en', price: '$9.90', quota: 'Quota: 100,000' },
    { language: 'Persian', lng: 'fa', price: '$۹٫۹۰', quota: 'Quota: ۱۰۰٬۰۰۰' },
  ])(
    'in $language, writes the product card price in the same digits as its quota',
    async ({ lng, price, quota }) => {
      await i18next.changeLanguage(lng)
      render(
        <CreemProductsSection
          products={[product]}
          onProductSelect={() => undefined}
        />
      )
      expect(screen.getByText(quota)).toBeInTheDocument()
      expect(screen.getByText(price)).toBeInTheDocument()
    }
  )

  it.each([
    { language: 'English', lng: 'en', price: '$9.90' },
    { language: 'Persian', lng: 'fa', price: '$۹٫۹۰' },
  ])(
    'in $language, writes the confirmation dialog price in the interface digits',
    async ({ lng, price }) => {
      await i18next.changeLanguage(lng)
      render(
        <CreemConfirmDialog
          open
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
          product={product}
          processing={false}
        />
      )
      expect(screen.getByText(price)).toBeInTheDocument()
    }
  )

  it('without a locale, keeps the fixed price form for callers that pass none', () => {
    expect(formatCreemPrice(9.9, 'USD')).toBe('$9.90')
    expect(formatCreemPrice(1234.5, 'EUR')).toBe('€1234.50')
  })
})
