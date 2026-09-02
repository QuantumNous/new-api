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
import { z } from 'zod'

import type { ModelOption } from '@/features/playground/types'

import type { ImageGenerationResponse } from '../types'

const IMAGE_MODEL_HINTS = [
  'gpt-image',
  'dall-e',
  'seedream',
  'imagen',
  'flux',
  'image',
  'wanx',
  'jimeng',
]

export const drawingSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt is required'),
  size: z.enum(['1024x1024', '1024x1792', '1792x1024']),
})

export type DrawingFormValues = z.infer<typeof drawingSchema>

export function filterImageModels(models: ModelOption[]): ModelOption[] {
  const matched = models.filter((model) => {
    const value = model.value.toLowerCase()
    return IMAGE_MODEL_HINTS.some((hint) => value.includes(hint))
  })
  return matched.length > 0 ? matched : models
}

export function getDrawingResultUrl(
  response: ImageGenerationResponse
): string | null {
  const image = response.data?.[0]
  if (image?.url) return image.url
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`
  return null
}
