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
import { describe, expect, test } from 'bun:test'
import type { ModelAccessModel } from '../types'
import {
  ALL_MODEL_CATEGORIES,
  filterModelsByCategory,
  getModelCategory,
  getModelCategoryFilters,
} from './model-catalog-type'

function buildModel(
  overrides: Partial<ModelAccessModel> = {}
): ModelAccessModel {
  return {
    id: 'gpt-4o-mini',
    allowlist_match_key: 'gpt-4o-mini',
    vendor: null,
    supported_endpoint_types: ['openai'],
    availability_status: 'available',
    ...overrides,
  }
}

describe('getModelCategory', () => {
  test('classifies an image-generation endpoint as image', () => {
    const model = buildModel({
      id: 'gpt-image-2',
      supported_endpoint_types: ['image-generation'],
    })
    expect(getModelCategory(model)).toBe('image')
  })

  test('classifies an openai-video endpoint as video', () => {
    const model = buildModel({
      id: 'veo-3.1-generate-preview',
      supported_endpoint_types: ['openai-video'],
    })
    expect(getModelCategory(model)).toBe('video')
  })

  test('classifies a bare video endpoint as video', () => {
    const model = buildModel({
      id: 'seedance-2.0-pro',
      supported_endpoint_types: ['video'],
    })
    expect(getModelCategory(model)).toBe('video')
  })

  test('classifies a video-to-music endpoint as audio', () => {
    const model = buildModel({
      id: 'sonilo-video-to-music',
      supported_endpoint_types: ['video-to-music'],
    })
    expect(getModelCategory(model)).toBe('audio')
  })

  test('classifies an embeddings endpoint as embedding', () => {
    const model = buildModel({
      id: 'text-embedding-3-small',
      supported_endpoint_types: ['embeddings'],
    })
    expect(getModelCategory(model)).toBe('embedding')
  })

  test('classifies a jina-rerank endpoint as rerank', () => {
    const model = buildModel({
      id: 'jina-reranker-v2',
      supported_endpoint_types: ['jina-rerank'],
    })
    expect(getModelCategory(model)).toBe('rerank')
  })

  test('classifies an openai chat endpoint as chat', () => {
    expect(getModelCategory(buildModel())).toBe('chat')
  })

  test('classifies anthropic and gemini endpoints as chat', () => {
    expect(
      getModelCategory(buildModel({ supported_endpoint_types: ['anthropic'] }))
    ).toBe('chat')
    expect(
      getModelCategory(buildModel({ supported_endpoint_types: ['gemini'] }))
    ).toBe('chat')
  })

  // Endpoint metadata is routinely incomplete: gemini-embedding-001 ships
  // tagged only as ['gemini'], so the name has to be able to correct it.
  test('falls back to the model name when endpoints are untagged', () => {
    expect(
      getModelCategory(
        buildModel({ id: 'gemini-embedding-001', supported_endpoint_types: [] })
      )
    ).toBe('embedding')
    expect(
      getModelCategory(
        buildModel({ id: 'gpt-4o-mini-tts', supported_endpoint_types: [] })
      )
    ).toBe('audio')
    expect(
      getModelCategory(
        buildModel({ id: 'flux-1.1-pro', supported_endpoint_types: [] })
      )
    ).toBe('image')
    expect(
      getModelCategory(
        buildModel({ id: 'kling-v2-master', supported_endpoint_types: [] })
      )
    ).toBe('video')
  })

  test('corrects a mistagged embedding model that only claims a chat endpoint', () => {
    const model = buildModel({
      id: 'gemini-embedding-001',
      supported_endpoint_types: ['gemini'],
    })
    expect(getModelCategory(model)).toBe('embedding')
  })

  test('defaults an unknown untagged model to chat', () => {
    const model = buildModel({
      id: 'some-new-model',
      supported_endpoint_types: [],
    })
    expect(getModelCategory(model)).toBe('chat')
  })

  // A model that both chats and generates images (nano-banana) is most
  // usefully found under "image" — that is the capability people filter for.
  test('prefers the richer output modality when a model serves several', () => {
    const model = buildModel({
      id: 'gemini-3-pro-image',
      supported_endpoint_types: ['gemini', 'image-generation'],
    })
    expect(getModelCategory(model)).toBe('image')
  })
})

describe('getModelCategoryFilters', () => {
  test('lists only categories present in the given models, with counts', () => {
    const models = [
      buildModel({ id: 'gpt-4o', supported_endpoint_types: ['openai'] }),
      buildModel({ id: 'gpt-4o-mini', supported_endpoint_types: ['openai'] }),
      buildModel({
        id: 'gpt-image-2',
        supported_endpoint_types: ['image-generation'],
      }),
    ]

    expect(getModelCategoryFilters(models)).toEqual([
      { value: ALL_MODEL_CATEGORIES, count: 3 },
      { value: 'chat', count: 2 },
      { value: 'image', count: 1 },
    ])
  })

  test('orders categories consistently regardless of input order', () => {
    const models = [
      buildModel({
        id: 'sonilo-video-to-music',
        supported_endpoint_types: ['video-to-music'],
      }),
      buildModel({
        id: 'gpt-image-2',
        supported_endpoint_types: ['image-generation'],
      }),
      buildModel({ id: 'gpt-4o', supported_endpoint_types: ['openai'] }),
    ]

    expect(getModelCategoryFilters(models).map((item) => item.value)).toEqual([
      ALL_MODEL_CATEGORIES,
      'chat',
      'image',
      'audio',
    ])
  })

  test('returns only the all-filter for an empty model list', () => {
    expect(getModelCategoryFilters([])).toEqual([
      { value: ALL_MODEL_CATEGORIES, count: 0 },
    ])
  })
})

describe('filterModelsByCategory', () => {
  const chat = buildModel({ id: 'gpt-4o' })
  const image = buildModel({
    id: 'gpt-image-2',
    supported_endpoint_types: ['image-generation'],
  })

  test('returns every model for the all-category', () => {
    expect(filterModelsByCategory([chat, image], ALL_MODEL_CATEGORIES)).toEqual(
      [chat, image]
    )
  })

  test('keeps only models in the selected category', () => {
    expect(filterModelsByCategory([chat, image], 'image')).toEqual([image])
  })

  test('returns an empty list when no model matches', () => {
    expect(filterModelsByCategory([chat], 'video')).toEqual([])
  })
})
