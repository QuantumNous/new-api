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
import { describe, test } from 'node:test'
import { publicPricingSearchSchema } from './public-search'

describe('public pricing search schema', () => {
  test('falls back for invalid enum search values', () => {
    const parsed = publicPricingSearchSchema.parse({
      tokenUnit: 'invalid',
      view: 'grid',
    })

    assert.equal(parsed.tokenUnit, undefined)
    assert.equal(parsed.view, undefined)
  })

  test('accepts string boolean rechargePrice values', () => {
    assert.equal(
      publicPricingSearchSchema.parse({ rechargePrice: 'true' }).rechargePrice,
      true
    )
    assert.equal(
      publicPricingSearchSchema.parse({ rechargePrice: 'false' }).rechargePrice,
      false
    )
  })
})
