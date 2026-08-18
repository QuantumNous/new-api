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
  isSeedanceModel,
  modelRatioToSeedanceBasePriceRmb,
  seedanceBasePriceRmbToModelRatio,
} from '../seedance-pricing'

describe('Seedance pricing conversion', () => {
  it('recognizes Seedance model names case-insensitively', () => {
    expect(isSeedanceModel('doubao-seedance-2-0-260128')).toBe(true)
    expect(isSeedanceModel('SEEDANCE-custom-alias')).toBe(true)
    expect(isSeedanceModel('doubao-vision-pro')).toBe(false)
  })

  it.each([46, 37, 70])(
    'round-trips the documented RMB base price %s',
    (priceRmb) => {
      const ratio = seedanceBasePriceRmbToModelRatio(priceRmb)

      expect(modelRatioToSeedanceBasePriceRmb(ratio)).toBeCloseTo(priceRmb, 10)
    }
  )
})
