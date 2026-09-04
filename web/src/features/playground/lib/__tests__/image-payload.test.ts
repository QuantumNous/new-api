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
import { describe, expect, test } from 'vitest'

import type { ImageConfig } from '../../types'
import { imageFormSchema, IMAGE_MAX_N, IMAGE_PROMPT_MAX_CHARS } from '../image/image-form-schema'
import {
  buildImageGenerationPayload,
  isSafeImageUrl,
} from '../image/image-payload-utils'

const baseImageConfig: ImageConfig = {
  model: 'dall-e-3',
  group: 'default',
  n: 1,
  size: 'auto',
  quality: 'auto',
  response_format: 'auto',
}

describe('buildImageGenerationPayload', () => {
  test('keeps model, prompt and n while omitting auto options', () => {
    const payload = buildImageGenerationPayload('a red fox', baseImageConfig)

    expect(payload).toEqual({
      model: 'dall-e-3',
      prompt: 'a red fox',
      n: 1,
    })
    expect(payload.size).toBeUndefined()
    expect(payload.quality).toBeUndefined()
    expect(payload.response_format).toBeUndefined()
  })

  test('passes concrete size, quality and response_format values through', () => {
    const payload = buildImageGenerationPayload('a red fox', {
      ...baseImageConfig,
      size: '1024x1024',
      quality: 'hd',
      response_format: 'b64_json',
    })

    expect(payload.size).toBe('1024x1024')
    expect(payload.quality).toBe('hd')
    expect(payload.response_format).toBe('b64_json')
  })
})

describe('isSafeImageUrl', () => {
  test('accepts http and https URLs', () => {
    expect(isSafeImageUrl('https://example.com/image.png')).toBe(true)
    expect(isSafeImageUrl('http://example.com/image.png')).toBe(true)
  })

  test('rejects non-http protocols and malformed values', () => {
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeImageUrl('data:image/png;base64,AAAA')).toBe(false)
    expect(isSafeImageUrl('ftp://example.com/image.png')).toBe(false)
    expect(isSafeImageUrl('not a url')).toBe(false)
  })
})

describe('imageFormSchema', () => {
  const validInput = {
    group: 'default',
    model: 'dall-e-3',
    prompt: 'a red fox in snow',
    n: 1,
  }

  test('applies defaults for optional options and clamps n to defaults', () => {
    const parsed = imageFormSchema.parse(validInput)

    expect(parsed.n).toBe(1)
    expect(parsed.size).toBe('auto')
    expect(parsed.quality).toBe('auto')
    expect(parsed.response_format).toBe('auto')
  })

  test('rejects an empty prompt and over-long prompts', () => {
    expect(
      imageFormSchema.safeParse({ ...validInput, prompt: '   ' }).success
    ).toBe(false)
    expect(
      imageFormSchema.safeParse({
        ...validInput,
        prompt: 'x'.repeat(IMAGE_PROMPT_MAX_CHARS + 1),
      }).success
    ).toBe(false)
  })

  test('rejects n outside 1..IMAGE_MAX_N and non-integer n', () => {
    expect(imageFormSchema.safeParse({ ...validInput, n: 0 }).success).toBe(
      false
    )
    expect(
      imageFormSchema.safeParse({ ...validInput, n: IMAGE_MAX_N + 1 }).success
    ).toBe(false)
    expect(imageFormSchema.safeParse({ ...validInput, n: 1.5 }).success).toBe(
      false
    )
  })

  test('rejects unknown size/quality/response_format values', () => {
    expect(
      imageFormSchema.safeParse({ ...validInput, size: '12x999999' }).success
    ).toBe(false)
    expect(
      imageFormSchema.safeParse({ ...validInput, quality: 'ultra' }).success
    ).toBe(false)
    expect(
      imageFormSchema.safeParse({ ...validInput, response_format: 'xml' })
        .success
    ).toBe(false)
  })

  test('requires group and model', () => {
    expect(imageFormSchema.safeParse({ ...validInput, group: '' }).success).toBe(
      false
    )
    expect(imageFormSchema.safeParse({ ...validInput, model: '' }).success).toBe(
      false
    )
  })
})
