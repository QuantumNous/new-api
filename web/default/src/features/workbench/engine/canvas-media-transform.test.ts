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

import { keyboardStep, normalizeCrop } from './canvas-media-transform'

describe('canvas media interaction logic', () => {
  it('normalizes a free crop dragged in either direction', () => {
    expect(normalizeCrop({ x: 90, y: 70 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 80,
      height: 50,
    })
  })

  it('uses a precise step normally and a larger step with Shift', () => {
    expect(keyboardStep(false)).toBe(1)
    expect(keyboardStep(true)).toBe(10)
  })
})
