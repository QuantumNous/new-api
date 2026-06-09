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
import type {
  ImageGenerationConfig,
  ImageGenerationRequest,
} from '../types'
import {
  normalizeImageGenerationCount,
  shouldSplitImageGenerationRequests,
} from './image-generation-capabilities'

export function buildImageGenerationPayload(
  prompt: string,
  config: ImageGenerationConfig,
  count = config.n
): ImageGenerationRequest {
  const payload: ImageGenerationRequest = {
    model: config.model,
    group: config.group,
    prompt: prompt.trim(),
    size: config.size,
    quality: config.quality,
    n: normalizeImageGenerationCount(count),
    response_format: config.response_format,
  }

  if (config.output_format) {
    payload.output_format = config.output_format
  }
  if (
    config.output_compression !== undefined &&
    config.output_compression !== null
  ) {
    payload.output_compression = config.output_compression
  }
  if (config.moderation) {
    payload.moderation = config.moderation
  }

  return payload
}

export function buildImageGenerationPayloads(
  prompt: string,
  config: ImageGenerationConfig
): ImageGenerationRequest[] {
  const count = normalizeImageGenerationCount(config.n)
  if (shouldSplitImageGenerationRequests(config.model) && count > 1) {
    return Array.from({ length: count }, () =>
      buildImageGenerationPayload(prompt, config, 1)
    )
  }

  return [buildImageGenerationPayload(prompt, config, count)]
}
