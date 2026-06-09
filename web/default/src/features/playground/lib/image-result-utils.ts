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
import type { ImageGenerationConfig, ImageResult } from '../types'

export function getImageSource(
  image: ImageResult,
  config: Pick<ImageGenerationConfig, 'output_format'>
): string {
  if (image.url) return image.url
  if (!image.b64_json) return ''
  return normalizeBase64Image(image.b64_json, config.output_format || 'png')
}

export function normalizeBase64Image(
  value: string,
  format: string = 'png'
): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('data:')) return trimmed
  return `data:image/${format};base64,${trimmed}`
}

export function isImageResultRenderable(image: ImageResult): boolean {
  return Boolean(image.url || image.b64_json)
}
