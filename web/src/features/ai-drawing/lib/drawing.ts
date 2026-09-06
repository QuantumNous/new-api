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

export const IMAGE_RATIO_OPTIONS = [
  { size: '1024x1024', ratio: '1:1', labelKey: 'Square' },
  { size: '864x1152', ratio: '3:4', labelKey: 'Portrait' },
  { size: '1536x864', ratio: '16:9', labelKey: 'Landscape' },
  { size: '1152x864', ratio: '4:3', labelKey: 'Landscape' },
  { size: '864x1536', ratio: '9:16', labelKey: 'Portrait' },
  { size: '1024x1536', ratio: '2:3', labelKey: 'Portrait' },
  { size: '1536x1024', ratio: '3:2', labelKey: 'Landscape' },
  { size: '1792x768', ratio: '21:9', labelKey: 'Landscape' },
] as const
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
  size: z.enum([
    '1024x1024',
    '864x1152',
    '1536x864',
    '1152x864',
    '864x1536',
    '1024x1536',
    '1536x1024',
    '1792x768',
  ]),
  count: z
    .string()
    .refine(
      (value) =>
        value.trim() === '' ||
        (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 100),
      'Invalid image count'
    ),
})
export type DrawingFormValues = z.infer<typeof drawingSchema>
export function filterImageModels(models: ModelOption[]): ModelOption[] {
  const matched = models.filter((model) =>
    IMAGE_MODEL_HINTS.some((hint) => model.value.toLowerCase().includes(hint))
  )
  return matched.length > 0 ? matched : models
}
export function getDefaultImageModel(models: ModelOption[]): string {
  return (
    models.find((model) => model.value.toLowerCase() === 'gpt-image-2')
      ?.value ??
    models[0]?.value ??
    ''
  )
}
export function saveDrawingBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
