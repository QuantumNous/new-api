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

import { DEFAULT_SYSTEM_NAME } from '../constants'
import { PRODUCT_NAME, resolveProductName } from '../product-brand'

describe('resolveProductName', () => {
  it('keeps the public product brand distinct from the upstream default', () => {
    expect(PRODUCT_NAME).toBe('野菜')
    expect(DEFAULT_SYSTEM_NAME).toBe('New API')
  })

  it.each([undefined, null, '', '  ', 'New API'])(
    'shows 野菜 when the system name is the protected default (%s)',
    (value) => {
      expect(resolveProductName(value)).toBe(PRODUCT_NAME)
    }
  )

  it('preserves an operator-defined system name', () => {
    expect(resolveProductName('  Custom API  ')).toBe('Custom API')
  })
})
