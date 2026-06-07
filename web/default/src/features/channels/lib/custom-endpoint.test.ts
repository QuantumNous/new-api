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
import {
  createEmptyCustomEndpointRouteDraft,
  customEndpointRouteDraftsToRoutes,
  formatCustomEndpointRoutes,
  getAllowedCustomEndpointTransformers,
  getCustomEndpointRoutesTextState,
  validateCustomEndpointRoutesText,
  type CustomEndpointRouteDraft,
} from './custom-endpoint'

describe('custom endpoint channel settings', () => {
  test('requires at least one route when the field is required', () => {
    assert.equal(
      validateCustomEndpointRoutesText('', true),
      'At least one custom endpoint route is required'
    )
  })

  test('accepts full final URLs with query and model placeholder', () => {
    const routes = formatCustomEndpointRoutes({
      '/v1beta/models/{model}:generateContent': {
        path: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?alt=sse',
        transformer: 'gemini_generate_content',
      },
    })

    assert.equal(validateCustomEndpointRoutesText(routes, true), null)
  })

  test('rejects unsupported entry paths before submit', () => {
    const routes = formatCustomEndpointRoutes({
      '/v1/unknown': {
        path: 'https://api.example.com/v1/unknown',
        transformer: 'openai_chat_completions',
      },
    })

    assert.equal(
      validateCustomEndpointRoutesText(routes, true),
      'Route entry path is unsupported: /v1/unknown'
    )
  })

  test('keeps stream options implicit unless explicitly disabled', () => {
    const drafts: CustomEndpointRouteDraft[] = [
      {
        id: 'custom-endpoint-route-0',
        entryPath: '/v1/chat/completions',
        path: 'https://api.example.com/v1/chat/completions',
        transformer: 'openai_chat_completions',
        streamOptionsSupported: true,
      },
      {
        id: 'custom-endpoint-route-1',
        entryPath: '/v1/messages',
        path: 'https://api.example.com/v1/messages',
        transformer: 'claude_messages',
        streamOptionsSupported: false,
      },
    ]

    assert.deepEqual(customEndpointRouteDraftsToRoutes(drafts), {
      '/v1/chat/completions': {
        path: 'https://api.example.com/v1/chat/completions',
        transformer: 'openai_chat_completions',
      },
      '/v1/messages': {
        path: 'https://api.example.com/v1/messages',
        transformer: 'claude_messages',
        stream_options_supported: false,
      },
    })
  })

  test('allocates stable draft ids after a middle route is removed', () => {
    const nextDraft = createEmptyCustomEndpointRouteDraft([
      {
        id: 'custom-endpoint-route-0',
        entryPath: '/v1/chat/completions',
        path: '',
        transformer: 'openai_chat_completions',
        streamOptionsSupported: true,
      },
      {
        id: 'custom-endpoint-route-2',
        entryPath: '/v1/responses',
        path: '',
        transformer: 'openai_responses',
        streamOptionsSupported: true,
      },
    ])

    assert.equal(nextDraft.id, 'custom-endpoint-route-3')
    assert.equal(nextDraft.entryPath, '/v1/completions')
  })

  test('narrows transformer options for Gemini embedding routes', () => {
    assert.deepEqual(
      getAllowedCustomEndpointTransformers(
        '/v1/models/text-embedding-004:embedContent'
      ),
      [{ value: 'gemini_embeddings', label: 'Gemini Embeddings' }]
    )
  })

  test('returns drafts and validation from a single text-state interface', () => {
    const routes = formatCustomEndpointRoutes({
      '/v1/messages': {
        path: 'https://api.openai.com/v1/chat/completions',
        transformer: 'openai_chat_completions',
      },
    })

    const state = getCustomEndpointRoutesTextState(routes, true)

    assert.equal(state.parseError, null)
    assert.equal(state.validationError, null)
    assert.equal(state.drafts.length, 1)
    assert.equal(state.drafts[0].entryPath, '/v1/messages')
  })
})
