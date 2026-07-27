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

/** Imported metadata spells document input `pdf`; the admin UI also allows `file`. */
const DOCUMENT_INPUT_MODALITIES = new Set(['pdf', 'file'])

const DOCUMENT_INPUT_TAG = /\binput:(pdf|file)\b/

/**
 * Whether a PDF can be sent to this model as a native `file` content part.
 *
 * Only curated model metadata counts. A model name says nothing about the
 * channel a request is routed to, and most OpenAI-compatible upstreams reject
 * an unknown `file` part outright, so an unknown model falls back to
 * browser-extracted text, which every model accepts.
 */
export function supportsNativeFileInput(model?: ModelFileMetadata): boolean {
  if (!model) return false
  const modalities = model.input_modalities ?? []
  if (modalities.some((modality) => DOCUMENT_INPUT_MODALITIES.has(modality))) {
    return true
  }
  return DOCUMENT_INPUT_TAG.test(model.tags?.toLowerCase() ?? '')
}
