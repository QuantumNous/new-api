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
import type { ImageGenerationConfig } from '../types'

export const MAX_IMAGE_GENERATION_COUNT = 4
export const PLAYGROUND_IMAGE_SIZE_OPTIONS = [
  '1024x1024',
  '1024x1536',
  '1536x1024',
  '1024x1792',
  '1792x1024',
  '2048x2048',
  '2560x1440',
  '1440x2560',
  '3840x2160',
  '2160x3840',
] as const
export const PLAYGROUND_IMAGE_QUALITY_OPTIONS = [
  'auto',
  'low',
  'medium',
  'high',
] as const satisfies readonly ImageGenerationConfig['quality'][]
export const PLAYGROUND_IMAGE_OUTPUT_FORMAT_OPTIONS = [
  'png',
  'jpeg',
  'webp',
] as const satisfies readonly NonNullable<
  ImageGenerationConfig['output_format']
>[]

export function isSupportedPlaygroundImageModel(model: string): boolean {
  return model.trim().toLowerCase() === 'gpt-image-2'
}

export function normalizePlaygroundImageConfig(
  config: ImageGenerationConfig
): ImageGenerationConfig {
  const size = PLAYGROUND_IMAGE_SIZE_OPTIONS.includes(
    config.size as (typeof PLAYGROUND_IMAGE_SIZE_OPTIONS)[number]
  )
    ? config.size
    : PLAYGROUND_IMAGE_SIZE_OPTIONS[0]
  const quality = PLAYGROUND_IMAGE_QUALITY_OPTIONS.includes(
    config.quality as (typeof PLAYGROUND_IMAGE_QUALITY_OPTIONS)[number]
  )
    ? config.quality
    : 'auto'
  const outputFormat = PLAYGROUND_IMAGE_OUTPUT_FORMAT_OPTIONS.includes(
    config.output_format as NonNullable<ImageGenerationConfig['output_format']>
  )
    ? config.output_format
    : 'png'

  return {
    ...config,
    model: isSupportedPlaygroundImageModel(config.model)
      ? config.model
      : 'gpt-image-2',
    size,
    quality,
    response_format: 'b64_json',
    output_format: outputFormat,
  }
}

export function normalizeImageGenerationCount(count: number): number {
  return Math.min(
    MAX_IMAGE_GENERATION_COUNT,
    Math.max(1, Number.isFinite(count) ? count : 1)
  )
}

export function supportsImageEditingModel(model: string): boolean {
  return isSupportedPlaygroundImageModel(model)
}
