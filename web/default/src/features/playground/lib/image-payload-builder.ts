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
  ImageReferenceInput,
} from '../types'
import { normalizePlaygroundImageConfig } from './image-generation-capabilities'

export function buildImageGenerationPayload(
  prompt: string,
  config: ImageGenerationConfig
): ImageGenerationRequest {
  const normalizedConfig = normalizePlaygroundImageConfig(config)
  const payload: ImageGenerationRequest = {
    model: normalizedConfig.model,
    group: normalizedConfig.group,
    prompt: prompt.trim(),
    size: normalizedConfig.size,
    quality: normalizedConfig.quality,
    n: 1,
  }

  if (normalizedConfig.output_format) {
    payload.output_format = normalizedConfig.output_format
  }
  if (
    normalizedConfig.output_compression !== undefined &&
    normalizedConfig.output_compression !== null
  ) {
    payload.output_compression = normalizedConfig.output_compression
  }
  if (normalizedConfig.moderation) {
    payload.moderation = normalizedConfig.moderation
  }

  return payload
}

export function buildImageEditFormData(
  prompt: string,
  config: ImageGenerationConfig,
  referenceImages: ImageReferenceInput[]
): FormData {
  const normalizedConfig = normalizePlaygroundImageConfig(config)
  const formData = new FormData()

  formData.append('model', normalizedConfig.model)
  formData.append('group', normalizedConfig.group)
  formData.append('prompt', prompt.trim())
  formData.append('size', normalizedConfig.size)
  formData.append('quality', normalizedConfig.quality)
  formData.append('n', '1')

  if (normalizedConfig.output_format) {
    formData.append('output_format', normalizedConfig.output_format)
  }
  if (
    normalizedConfig.output_compression !== undefined &&
    normalizedConfig.output_compression !== null
  ) {
    formData.append(
      'output_compression',
      String(normalizedConfig.output_compression)
    )
  }
  if (normalizedConfig.moderation) {
    formData.append('moderation', normalizedConfig.moderation)
  }

  referenceImages.forEach((reference) => {
    formData.append('image', reference.file, reference.file.name)
  })

  return formData
}
