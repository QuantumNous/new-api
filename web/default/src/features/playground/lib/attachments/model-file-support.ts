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
import type { PricingModel } from '@/features/pricing/types'

type ModelFileMetadata = Pick<PricingModel, 'model_name'> &
  Partial<Pick<PricingModel, 'input_modalities' | 'tags'>>

/**
 * Model families whose relay adaptors translate an OpenAI `file` content part
 * into a provider-native document block. Everything else forwards the part
 * unchanged, where upstreams typically drop or reject it.
 */
const NATIVE_FILE_MODEL_PATTERN =
  /^(claude|gemini|gpt-4o|gpt-4\.1|gpt-4\.5|gpt-5|o1|o3|o4)/

/**
 * Whether a PDF can be sent to this model as a native `file` part. When false
 * the caller must fall back to browser-extracted text, otherwise the
 * attachment reaches the upstream in a form it silently ignores.
 */
export function supportsNativeFileInput(model?: ModelFileMetadata): boolean {
  if (!model) return false
  if (model.input_modalities?.length) {
    return model.input_modalities.includes('file')
  }
  if (/\binput:file\b/.test(model.tags?.toLowerCase() ?? '')) return true
  return NATIVE_FILE_MODEL_PATTERN.test(model.model_name.toLowerCase())
}
