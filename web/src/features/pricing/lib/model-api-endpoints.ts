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
import type { PricingEndpoint, PricingModel } from '../types'

const DEFAULT_ENDPOINTS: Record<string, PricingEndpoint> = {
  anthropic: { path: '/v1/messages', method: 'POST' },
  'async-image-generation': {
    path: '/v1/async/images/generations',
    method: 'POST',
  },
  embeddings: { path: '/v1/embeddings', method: 'POST' },
  gemini: {
    path: '/v1beta/models/{model}:generateContent',
    method: 'POST',
  },
  'image-generation': { path: '/v1/images/generations', method: 'POST' },
  'jina-rerank': { path: '/v1/rerank', method: 'POST' },
  openai: { path: '/v1/chat/completions', method: 'POST' },
  'openai-response': { path: '/v1/responses', method: 'POST' },
  'openai-response-compact': {
    path: '/v1/responses/compact',
    method: 'POST',
  },
  'openai-video': { path: '/v1/video/generations', method: 'POST' },
}

export type ResolvedModelEndpoint = {
  type: string
  path: string
  method: string
}

/**
 * Resolve the endpoints shown in the API example panel.
 *
 * Pricing data can contain a supported endpoint with an empty path. The
 * public gateway still exposes stable routes for those known endpoint types,
 * so the model panel can safely fall back to them. Explicit non-empty backend
 * configuration always wins.
 */
export function resolveModelApiEndpoints(
  model: PricingModel,
  endpointMap: Record<string, PricingEndpoint>
): ResolvedModelEndpoint[] {
  const configuredTypes = model.supported_endpoint_types ?? []
  const normalizedTags = (model.tags ?? '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
  const looksLikeImageModel =
    normalizedTags.includes('image') ||
    model.output_modalities?.includes('image') ||
    /(?:image|nano-banana)/i.test(model.model_name)
  const endpointTypes =
    configuredTypes.length > 0
      ? configuredTypes
      : [looksLikeImageModel ? 'async-image-generation' : 'openai']
  const orderedEndpointTypes = looksLikeImageModel
    ? [...endpointTypes].sort(
        (a, b) =>
          Number(b === 'async-image-generation') -
          Number(a === 'async-image-generation')
      )
    : endpointTypes

  return orderedEndpointTypes.flatMap((type) => {
    const configured = endpointMap[type]
    const fallback = DEFAULT_ENDPOINTS[type]
    const path = configured?.path?.trim() || fallback?.path || ''
    if (!path) return []

    return [
      {
        type,
        path: path.includes('{model}')
          ? path.replaceAll('{model}', model.model_name)
          : path,
        method:
          configured?.method?.trim().toUpperCase() ||
          fallback?.method ||
          'POST',
      },
    ]
  })
}
