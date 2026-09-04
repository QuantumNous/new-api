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
import type { ImageConfig, ImageGenerationRequest } from '../../types'

const AUTO_OPTION = 'auto'

function omitAutoOption(value: string): string | undefined {
  return value === AUTO_OPTION ? undefined : value
}

/**
 * Build an image generation payload from the image config.
 * Options set to `auto` are omitted so the backend/provider default applies.
 */
export function buildImageGenerationPayload(
  prompt: string,
  imageConfig: ImageConfig
): ImageGenerationRequest {
  return {
    model: imageConfig.model,
    prompt,
    n: imageConfig.n,
    size: omitAutoOption(imageConfig.size),
    quality: omitAutoOption(imageConfig.quality),
    response_format: omitAutoOption(imageConfig.response_format) as
      | 'url'
      | 'b64_json'
      | undefined,
  }
}

export function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
