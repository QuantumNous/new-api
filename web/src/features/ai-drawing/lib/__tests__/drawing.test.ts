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
  getDrawingResultUrl,
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

  it('maps friendly ratios to provider-supported pixel sizes', () => {
    expect(IMAGE_RATIO_OPTIONS).toEqual([
      { size: '1792x1024', ratio: '16:9', labelKey: 'Landscape' },
      { size: '1024x1792', ratio: '9:16', labelKey: 'Portrait' },
      { size: '1024x1024', ratio: '1:1', labelKey: 'Square' },
    ])
  })
})

describe('AI drawing response parsing', () => {
  it('uses a provider URL when one is returned', () => {
    expect(
      getDrawingResultUrl({ data: [{ url: 'https://example.com/image.png' }] })
    ).toBe('https://example.com/image.png')
  })

  it('converts base64 output into a displayable PNG data URL', () => {
    expect(getDrawingResultUrl({ data: [{ b64_json: 'aW1hZ2U=' }] })).toBe(
      'data:image/png;base64,aW1hZ2U='
    )
  })

  it('returns null for an empty provider response', () => {
    expect(getDrawingResultUrl({ data: [] })).toBeNull()
  })
})
