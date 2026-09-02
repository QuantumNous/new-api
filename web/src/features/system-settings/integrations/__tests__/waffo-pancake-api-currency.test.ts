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
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  createWaffoPancakePair,
  saveWaffoPancakeConfig,
} from '../waffo-pancake-api'

const { post } = vi.hoisted(() => ({
  post: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: { post },
}))

describe('Waffo Pancake pair API currency', () => {
  beforeEach(() => {
    post.mockResolvedValue({ data: { message: 'success' } })
  })

  test('sends the selected CNY product currency in normalized form', async () => {
    await createWaffoPancakePair({
      merchantID: 'merchant-test',
      privateKey: 'private-test',
      returnURL: 'https://example.com/wallet',
      currency: ' cny ',
    })

    expect(post).toHaveBeenCalledWith('/api/option/waffo-pancake/pair', {
      merchant_id: 'merchant-test',
      private_key: 'private-test',
      return_url: 'https://example.com/wallet',
      currency: 'CNY',
    })
  })

  test('sends wallet fees with the atomic Pancake configuration save', async () => {
    await saveWaffoPancakeConfig({
      merchantID: 'merchant-test',
      privateKey: '',
      returnURL: 'https://example.com/wallet',
      storeID: 'store-test',
      productID: 'product-test',
      currency: 'CNY',
      unitPrice: 7.3,
      minTopup: 10,
      feePercent: 2.9,
      feeFixed: 0.6,
    })

    expect(post).toHaveBeenCalledWith('/api/option/waffo-pancake/save', {
      merchant_id: 'merchant-test',
      private_key: '',
      return_url: 'https://example.com/wallet',
      store_id: 'store-test',
      product_id: 'product-test',
      currency: 'CNY',
      unit_price: 7.3,
      min_topup: 10,
      fee_percent: 2.9,
      fee_fixed: 0.6,
    })
  })

  test('keeps omitted currency compatible with legacy USD creation', async () => {
    await createWaffoPancakePair({
      merchantID: 'merchant-test',
      privateKey: 'private-test',
      returnURL: '',
    })

    expect(post).toHaveBeenCalledWith('/api/option/waffo-pancake/pair', {
      merchant_id: 'merchant-test',
      private_key: 'private-test',
      return_url: '',
      currency: 'USD',
    })
  })
})
