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
import type { TFunction } from 'i18next'
import type { ModelAccessModel } from '../types'

export const ALL_MODEL_CATEGORIES = 'all'

export type ModelCategory =
  | 'chat'
  | 'image'
  | 'video'
  | 'audio'
  | 'embedding'
  | 'rerank'

export type ModelCategoryFilter = ModelCategory | typeof ALL_MODEL_CATEGORIES

export type ModelCategoryFilterOption = {
  value: ModelCategoryFilter
  count: number
}

/**
 * Display order for the category chips. Chat leads because it is the largest
 * bucket on most deployments; the long-tail machine formats trail.
 */
const CATEGORY_ORDER: ModelCategory[] = [
  'chat',
  'image',
  'video',
  'audio',
  'embedding',
  'rerank',
]

// Endpoint tags are the primary signal. `video` and `openai-video` both denote
// video generation; `video-to-music` produces audio despite the `video` prefix,
// so it is matched before the video endpoints.
const ENDPOINT_CATEGORIES: Array<[string, ModelCategory]> = [
  ['video-to-music', 'audio'],
  ['image-generation', 'image'],
  ['openai-video', 'video'],
  ['video', 'video'],
  ['embeddings', 'embedding'],
  ['jina-rerank', 'rerank'],
]

// Endpoint metadata is routinely incomplete or wrong: gemini-embedding-001
// ships tagged only as ['gemini']. These name patterns correct such rows, and
// also classify models that carry no endpoint tags at all.
const NAME_CATEGORIES: Array<[RegExp, ModelCategory]> = [
  [/(^|[-_./])(?:embedding|embeddings)(?:$|[-_./]|-?\d)/i, 'embedding'],
  [/(^|[-_./])(?:rerank|reranker)(?:$|[-_./]|-?\d)/i, 'rerank'],
  [/(^|[-_./])(?:tts|whisper|transcribe|speech|audio|music|suno)(?:$|[-_./])/i, 'audio'],
  [
    /(^|[-_./])(?:video|seedance|sora|kling|veo|wan|hailuo|runway|pika|luma)(?:$|[-_./])/i,
    'video',
  ],
  [
    /(^|[-_./])(?:image|dall-?e|imagen|flux|stable-diffusion|sdxl|midjourney|jimeng|banana)(?:$|[-_./]|-?\d)/i,
    'image',
  ],
]

/**
 * Best-effort category for a model, used by the catalog's type filter.
 *
 * Name patterns are consulted before the generic chat endpoints so a mistagged
 * embedding model does not land in "chat", but after the specific output
 * endpoints (image-generation and friends) which are authoritative when
 * present. A model with no usable signal is treated as chat.
 */
export function getModelCategory(model: ModelAccessModel): ModelCategory {
  const endpoints = model.supported_endpoint_types ?? []
  for (const [endpoint, category] of ENDPOINT_CATEGORIES) {
    if (endpoints.includes(endpoint)) return category
  }

  const name = model.id ?? ''
  for (const [pattern, category] of NAME_CATEGORIES) {
    if (pattern.test(name)) return category
  }

  return 'chat'
}

export function getModelCategoryFilters(
  models: readonly ModelAccessModel[]
): ModelCategoryFilterOption[] {
  const counts = new Map<ModelCategory, number>()
  for (const model of models) {
    const category = getModelCategory(model)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }

  return [
    { value: ALL_MODEL_CATEGORIES as ModelCategoryFilter, count: models.length },
    ...CATEGORY_ORDER.filter((category) => counts.has(category)).map(
      (category) => ({
        value: category as ModelCategoryFilter,
        count: counts.get(category) ?? 0,
      })
    ),
  ]
}

export function filterModelsByCategory(
  models: readonly ModelAccessModel[],
  category: ModelCategoryFilter
): ModelAccessModel[] {
  if (category === ALL_MODEL_CATEGORIES) return [...models]
  return models.filter((model) => getModelCategory(model) === category)
}

export function getModelCategoryLabel(
  category: ModelCategoryFilter,
  t: TFunction
): string {
  switch (category) {
    case ALL_MODEL_CATEGORIES:
      return t('All')
    case 'chat':
      return t('Chat')
    case 'image':
      return t('Image')
    case 'video':
      return t('Video')
    case 'audio':
      return t('Audio')
    case 'embedding':
      return t('Embeddings')
    case 'rerank':
      return t('Rerank')
  }
}
