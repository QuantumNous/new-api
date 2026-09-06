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
  filterImageModels,
  getDefaultImageModel,
  drawingSchema,
  IMAGE_RATIO_OPTIONS,
} from '../drawing'

describe('AI drawing model filtering', () => {
  it('keeps image models when the group also contains chat models', () => {
    const models = [
      { label: 'GPT Chat', value: 'gpt-5' },
      { label: 'GPT Image', value: 'gpt-image-2' },
    ]

    expect(filterImageModels(models)).toEqual([models[1]])
  })

  it('keeps all models when custom image model names have no known hint', () => {
    const models = [{ label: 'Custom Art', value: 'custom-art-v1' }]

    expect(filterImageModels(models)).toEqual(models)
  })

  it('prefers gpt-image-2 regardless of model list order', () => {
    const models = [
      { label: 'DALL-E', value: 'dall-e-3' },
      { label: 'GPT Image', value: 'gpt-image-2' },
    ]

    expect(getDefaultImageModel(models)).toBe('gpt-image-2')
  })

  it('uses exact pixel ratios for all eight requested options', () => {
    expect(IMAGE_RATIO_OPTIONS.map((option) => option.ratio)).toEqual([
      '1:1',
      '3:4',
      '16:9',
      '4:3',
      '9:16',
      '2:3',
      '3:2',
      '21:9',
    ])
    for (const option of IMAGE_RATIO_OPTIONS) {
      const [width, height] = option.size.split('x').map(Number)
      const [rw, rh] = option.ratio.split(':').map(Number)
      expect(width * rh).toBe(height * rw)
    }
  })
  it('accepts blank count and integers but rejects negative, fractional and oversized counts', () => {
    for (const count of ['', '1', '8', '16']) {
      expect(
        drawingSchema.safeParse({ prompt: 'Product', size: '864x1152', count })
          .success
      ).toBe(true)
    }
    for (const count of ['0', '-1', '1.5', '999999999', 'NaN']) {
      expect(
        drawingSchema.safeParse({ prompt: 'Product', size: '864x1152', count })
          .success
      ).toBe(false)
    }
  })
})
