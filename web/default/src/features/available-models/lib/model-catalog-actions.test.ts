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
  canOpenModelInPlayground,
  getModelPlaygroundLink,
  getModelQuickstartLink,
  getModelQuickstartSearch,
  getModelPlaygroundSearch,
} from './model-catalog-actions'

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

describe('canOpenModelInPlayground', () => {
  test('allows a plain chat model', () => {
    expect(canOpenModelInPlayground(buildModel())).toBe(true)
  })

  test('allows a chat-capable image model the Playground renders inline', () => {
    expect(
      canOpenModelInPlayground(
        buildModel({
          id: 'gemini-3-pro-image',
          supported_endpoint_types: ['gemini', 'image-generation'],
        })
      )
    ).toBe(true)
  })

  test('allows a veo video model wired to the async video flow', () => {
    expect(
      canOpenModelInPlayground(
        buildModel({
          id: 'veo-3.1-generate-preview',
          supported_endpoint_types: ['openai-video'],
        })
      )
    ).toBe(true)
  })

  test('rejects an embedding model the Playground cannot call', () => {
    expect(
      canOpenModelInPlayground(
        buildModel({
          id: 'text-embedding-3-small',
          supported_endpoint_types: ['embeddings'],
        })
      )
    ).toBe(false)
  })

  test('rejects a rerank model', () => {
    expect(
      canOpenModelInPlayground(
        buildModel({
          id: 'jina-reranker-v2',
          supported_endpoint_types: ['jina-rerank'],
        })
      )
    ).toBe(false)
  })

  test('rejects a TTS model', () => {
    expect(
      canOpenModelInPlayground(buildModel({ id: 'gpt-4o-mini-tts' }))
    ).toBe(false)
  })

  // A model that upstreams dropped cannot be called anywhere; offering to open
  // it in the Playground would send the user into a guaranteed failure.
  test('rejects a model upstreams no longer support', () => {
    expect(
      canOpenModelInPlayground(
        buildModel({ availability_status: 'official_unsupported' })
      )
    ).toBe(false)
  })

  test('allows a model whose availability check merely failed', () => {
    expect(
      canOpenModelInPlayground(
        buildModel({ availability_status: 'unknown_failure' })
      )
    ).toBe(true)
  })
})

describe('getModelPlaygroundSearch', () => {
  test('carries the model id as the playground search param', () => {
    expect(getModelPlaygroundSearch('gpt-4o-mini')).toEqual({
      model: 'gpt-4o-mini',
    })
  })

  test('trims surrounding whitespace', () => {
    expect(getModelPlaygroundSearch('  gpt-4o-mini  ')).toEqual({
      model: 'gpt-4o-mini',
    })
  })
})

describe('getModelPlaygroundLink', () => {
  test('targets the playground carrying the model id', () => {
    expect(getModelPlaygroundLink('gpt-4o-mini')).toEqual({
      to: '/playground',
      search: { model: 'gpt-4o-mini' },
    })
  })

  test('trims surrounding whitespace', () => {
    expect(getModelPlaygroundLink('  gpt-4o-mini  ').search).toEqual({
      model: 'gpt-4o-mini',
    })
  })
})

describe('getModelQuickstartLink', () => {
  test('targets the dashboard overview carrying the model id', () => {
    expect(getModelQuickstartLink('gpt-4o-mini')).toEqual({
      to: '/dashboard/$section',
      params: { section: 'overview' },
      search: { model: 'gpt-4o-mini' },
    })
  })

  test('still targets the overview for a blank model id', () => {
    expect(getModelQuickstartLink('   ')).toEqual({
      to: '/dashboard/$section',
      params: { section: 'overview' },
      search: {},
    })
  })
})

describe('getModelQuickstartSearch', () => {
  test('carries the model id to the overview integration flow', () => {
    expect(getModelQuickstartSearch('gpt-4o-mini')).toEqual({
      model: 'gpt-4o-mini',
    })
  })

  test('omits the param for a blank model id', () => {
    expect(getModelQuickstartSearch('   ')).toEqual({})
  })
})
