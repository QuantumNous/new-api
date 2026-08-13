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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { FILTER_ALL, FUNCTION_TYPES, SORT_OPTIONS } from '../../constants.ts'
import type { PricingModel } from '../../types'
import {
  filterAndSortModels,
  filterByFunction,
  modelSupportsFunction,
} from '../filters.ts'

function pricingModel(
  modelName: string,
  vendorName: string,
  endpointTypes?: string[],
  tags?: string
): PricingModel {
  return {
    id: 1,
    model_name: modelName,
    vendor_name: vendorName,
    quota_type: 1,
    model_ratio: 0,
    completion_ratio: 0,
    enable_groups: ['default'],
    supported_endpoint_types: endpointTypes,
    tags,
  }
}

describe('pricing function filters', () => {
  test('groups provider-specific text protocols under the chat function', () => {
    const protocols = [
      'openai',
      'openai-response',
      'openai-response-compact',
      'anthropic',
      'gemini',
    ]

    for (const protocol of protocols) {
      const model = pricingModel(protocol, 'Provider', [protocol])
      assert.equal(modelSupportsFunction(model, FUNCTION_TYPES.CHAT), true)
    }
  })

  test('maps generation and retrieval endpoints to distinct functions', () => {
    const models = [
      pricingModel('image-model', 'Google', ['image-generation', 'openai']),
      pricingModel('video-model', 'OpenAI', ['openai-video']),
      pricingModel('embedding-model', 'OpenAI', ['embeddings']),
      pricingModel('rerank-model', 'Jina', ['jina-rerank']),
    ]

    assert.deepEqual(
      filterByFunction(models, FUNCTION_TYPES.IMAGE_GENERATION).map(
        (model) => model.model_name
      ),
      ['image-model']
    )
    assert.deepEqual(
      filterByFunction(models, FUNCTION_TYPES.VIDEO_GENERATION).map(
        (model) => model.model_name
      ),
      ['video-model']
    )
    assert.deepEqual(
      filterByFunction(models, FUNCTION_TYPES.EMBEDDINGS).map(
        (model) => model.model_name
      ),
      ['embedding-model']
    )
    assert.deepEqual(
      filterByFunction(models, FUNCTION_TYPES.RERANKING).map(
        (model) => model.model_name
      ),
      ['rerank-model']
    )
    assert.deepEqual(
      filterByFunction(models, FUNCTION_TYPES.CHAT).map(
        (model) => model.model_name
      ),
      []
    )
  })

  test('combines model vendor and function filters without pricing or tag filters', () => {
    const models = [
      pricingModel('google-image', 'Google', ['image-generation']),
      pricingModel('openai-image', 'OpenAI', ['image-generation']),
      pricingModel('google-chat', 'Google', ['gemini']),
    ]

    const filtered = filterAndSortModels(models, {
      search: '',
      vendor: 'Google',
      functionType: FUNCTION_TYPES.IMAGE_GENERATION,
      sortBy: SORT_OPTIONS.NAME,
    })

    assert.deepEqual(
      filtered.map((model) => model.model_name),
      ['google-image']
    )
    assert.equal(filterByFunction(models, FILTER_ALL), models)
  })

  test('uses catalog function tags when technical endpoints are generic or missing', () => {
    const models = [
      pricingModel(
        'nexa-image-nb-2',
        'Google',
        ['openai'],
        'image,google,nano-banana,image-generation,image-editing'
      ),
      pricingModel('nano-banana-pro', 'Google', [], 'image'),
      pricingModel(
        'gemini-image-preview',
        'Google',
        ['openai', 'async-image-generation'],
        'image,gemini'
      ),
      pricingModel(
        'gemini-chat',
        'Google',
        ['openai'],
        'llm,chat,vision,reasoning'
      ),
    ]

    assert.deepEqual(
      filterAndSortModels(models, {
        search: '',
        vendor: 'Google',
        functionType: FUNCTION_TYPES.IMAGE_GENERATION,
        sortBy: SORT_OPTIONS.NAME,
      }).map((model) => model.model_name),
      ['gemini-image-preview', 'nano-banana-pro', 'nexa-image-nb-2']
    )
    assert.deepEqual(
      filterAndSortModels(models, {
        search: '',
        vendor: 'Google',
        functionType: FUNCTION_TYPES.CHAT,
        sortBy: SORT_OPTIONS.NAME,
      }).map((model) => model.model_name),
      ['gemini-chat']
    )
  })

  test('does not place unknown or missing endpoints into a function category', () => {
    const unknown = pricingModel('custom-model', 'Custom', ['custom-endpoint'])
    const missing = pricingModel('missing-endpoint-model', 'Custom')

    assert.equal(modelSupportsFunction(unknown, FUNCTION_TYPES.CHAT), false)
    assert.equal(modelSupportsFunction(missing, FUNCTION_TYPES.CHAT), false)
    assert.equal(modelSupportsFunction(unknown, 'unknown-function'), false)
  })
})
