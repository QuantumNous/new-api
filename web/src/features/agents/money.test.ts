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
import { describe, expect, it } from 'vitest'

import {
  formatFixedPrice,
  formatRequestPrice,
} from '@/features/pricing/lib/price'
import type { PricingModel } from '@/features/pricing/types'

import { formatTopUps, priceCents } from './money'

describe('agent money display and validation', () => {
  it('keeps currencies separate and never adds unpaid quota balances', () => {
    expect(
      formatTopUps([
        { payment_provider: 'epay', payment_method: 'alipay', money: 12.3 },
        { payment_provider: 'epay', payment_method: 'wxpay', money: 2.7 },
        { payment_provider: 'stripe', payment_method: 'stripe', money: 5 },
      ])
    ).toBe('¥15.00 / USD 5.00')
  })
  it('accepts only whole cents within the agreed range', () => {
    expect(priceCents('0.02')).toBe(2)
    expect(priceCents('0.03')).toBe(3)
    expect(priceCents('0.06')).toBe(6)
    for (const price of ['0', '-0.02', '0.01', '0.07', '0.025', 'NaN', '1e-2'])
      {expect(priceCents(price)).toBeNull()}
  })
  it('displays the final customer price without applying group or recharge multipliers again', () => {
    const model: PricingModel = {
      id: 1,
      model_name: 'gpt-image-2',
      quota_type: 1,
      model_ratio: 0,
      completion_ratio: 0,
      enable_groups: ['default'],
      group_ratio: { default: 4 },
      model_price: 0.06,
      agent_price_cents: 3,
    }
    expect(formatRequestPrice(model, true, 7, 7, 'default')).toBe('¥0.03')
    expect(formatFixedPrice(model, 'default', true, 7, 7, { default: 4 })).toBe(
      '¥0.03'
    )
  })
})
