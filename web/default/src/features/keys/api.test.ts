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
import { afterEach, describe, test } from 'node:test'

import { api } from '@/lib/api'

import {
  fetchApiKeyModels,
  getApiKeys,
  selectApiKeyTestModel,
  testApiKeyModel,
  type ApiKeyModel,
  type ApiKeyTestEndpoint,
} from './api'

const originalFetch = globalThis.fetch
const originalApiGet = api.get

afterEach(() => {
  globalThis.fetch = originalFetch
  api.get = originalApiGet
})

describe('API key management', () => {
  test('normalizes legacy list responses without routing fields', async () => {
    const legacyKey = {
      id: 1,
      name: 'Legacy key',
      key: 'sk-legacy',
      status: 1,
      remain_quota: 100,
      used_quota: 0,
      unlimited_quota: false,
      expired_time: -1,
      created_time: 1,
      accessed_time: 0,
      group: 'default',
      model_limits_enabled: false,
      model_limits: '',
      allow_ips: '',
    }

    api.get = (async () => ({
      data: {
        success: true,
        data: {
          items: [legacyKey],
          total: 1,
          page: 1,
          page_size: 10,
        },
      },
    })) as typeof api.get

    const result = await getApiKeys()
    const apiKey = result.data?.items[0]

    assert.ok(apiKey)
    assert.deepEqual(apiKey.group_candidates, [])
    assert.equal(apiKey.group, 'default')
    assert.equal(apiKey.cross_group_retry, false)
  })
})

describe('API key availability test', () => {
  test('selects the requested provider defaults without overriding a manual choice', () => {
    const model = (
      id: string,
      supportedEndpointTypes: ApiKeyTestEndpoint[] = ['openai']
    ): ApiKeyModel => ({ id, supportedEndpointTypes })

    const bothProviderDefaults = [
      model('claude-opus-4-8', ['anthropic']),
      model('gpt-5.6-sol', ['openai-response']),
      model('manually-selected'),
    ]
    assert.equal(selectApiKeyTestModel(bothProviderDefaults)?.id, 'gpt-5.6-sol')
    assert.equal(
      selectApiKeyTestModel(bothProviderDefaults, 'manually-selected')?.id,
      'manually-selected'
    )
    assert.equal(
      selectApiKeyTestModel(bothProviderDefaults, '', {
        group: 'claude',
        name: 'Production API',
      })?.id,
      'claude-opus-4-8'
    )
    assert.equal(
      selectApiKeyTestModel(bothProviderDefaults, '', {
        group: 'premium',
        name: 'Anthropic API',
      })?.id,
      'claude-opus-4-8'
    )
    assert.equal(
      selectApiKeyTestModel([model('claude-opus-4-8', ['anthropic'])])?.id,
      'claude-opus-4-8'
    )
    assert.equal(
      selectApiKeyTestModel([
        model('not-testable', []),
        model('first-testable', ['embeddings']),
      ])?.id,
      'first-testable'
    )
  })

  test('loads and normalizes the models visible to the API key', async () => {
    let requestedUrl = ''
    let requestedInit: RequestInit | undefined
    globalThis.fetch = (async (input, init) => {
      requestedUrl = String(input)
      requestedInit = init
      return new Response(
        JSON.stringify({
          success: true,
          object: 'list',
          data: [
            {
              id: 'claude-sonnet-4-5',
              owned_by: 'anthropic',
              supported_endpoint_types: ['anthropic', 'openai', 'openai-video'],
            },
            'legacy-model',
            { id: 'claude-sonnet-4-5' },
          ],
        }),
        { status: 200 }
      )
    }) as typeof fetch

    const result = await fetchApiKeyModels(
      'https://api.example.com/v1/',
      'sk-secret'
    )

    assert.deepEqual(result, {
      success: true,
      models: [
        {
          id: 'claude-sonnet-4-5',
          ownedBy: 'anthropic',
          supportedEndpointTypes: ['anthropic', 'openai'],
        },
        {
          id: 'legacy-model',
          supportedEndpointTypes: ['openai'],
        },
      ],
    })
    assert.equal(requestedUrl, 'https://api.example.com/v1/models')
    assert.equal(requestedUrl.includes('sk-secret'), false)
    assert.equal(requestedInit?.method, 'GET')
    assert.equal(requestedInit?.body, undefined)
    assert.equal(requestedInit?.credentials, 'omit')
    assert.equal(requestedInit?.cache, 'no-store')
    assert.equal(requestedInit?.redirect, 'error')
    assert.equal(
      new Headers(requestedInit?.headers).get('Authorization'),
      'Bearer sk-secret'
    )
  })

  test('returns the API error message for a rejected key', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: { message: 'The API key is invalid.' } }),
        { status: 401 }
      )) as typeof fetch

    const result = await fetchApiKeyModels(
      'https://api.example.com/v1',
      'sk-invalid'
    )

    assert.equal(result.success, false)
    if (result.success) return
    assert.equal(result.failureKind, 'api')
    assert.equal(result.message, 'The API key is invalid.')
    assert.equal(result.status, 401)
  })

  test('rejects business errors and unexpected model responses', async () => {
    for (const response of [
      new Response(
        JSON.stringify({ success: false, message: 'Group lookup failed.' }),
        { status: 200 }
      ),
      new Response('<html>not an API response</html>', { status: 200 }),
    ]) {
      globalThis.fetch = (async () => response) as typeof fetch
      const result = await fetchApiKeyModels(
        'https://api.example.com/v1',
        'sk-secret'
      )
      assert.equal(result.success, false)
    }
  })

  test('builds the correct minimal request for every supported endpoint', async () => {
    const cases: Array<{
      endpointType: ApiKeyTestEndpoint
      expectedPath: string
      model: string
      responsePayload: unknown
      verifyBody: (body: Record<string, unknown>) => void
      verifyHeaders?: (headers: Headers) => void
    }> = [
      {
        endpointType: 'openai',
        expectedPath: '/v1/chat/completions',
        model: 'gpt-4o-mini',
        responsePayload: {
          choices: [{ message: { content: 'OK' } }],
        },
        verifyBody: (body) => {
          assert.equal(body.model, 'gpt-4o-mini')
          assert.equal(body.max_tokens, 16)
          assert.ok(Array.isArray(body.messages))
        },
      },
      {
        endpointType: 'openai-response',
        expectedPath: '/v1/responses',
        model: 'gpt-5.1',
        responsePayload: { output_text: 'OK' },
        verifyBody: (body) => {
          assert.equal(body.model, 'gpt-5.1')
          assert.equal(body.max_output_tokens, 16)
          assert.ok(Array.isArray(body.input))
        },
      },
      {
        endpointType: 'openai-response-compact',
        expectedPath: '/v1/responses/compact',
        model: 'gpt-5.1-compact',
        responsePayload: {
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'OK' }],
            },
          ],
        },
        verifyBody: (body) => {
          assert.equal(body.model, 'gpt-5.1-compact')
          assert.ok(Array.isArray(body.input))
        },
      },
      {
        endpointType: 'anthropic',
        expectedPath: '/v1/messages',
        model: 'claude-sonnet-4-5',
        responsePayload: {
          type: 'message',
          content: [{ type: 'text', text: 'OK' }],
        },
        verifyBody: (body) => {
          assert.equal(body.model, 'claude-sonnet-4-5')
          assert.equal(body.max_tokens, 16)
        },
        verifyHeaders: (headers) => {
          assert.equal(headers.get('anthropic-version'), '2023-06-01')
        },
      },
      {
        endpointType: 'gemini',
        expectedPath: '/v1beta/models/gemini-2.5-pro:generateContent',
        model: 'gemini-2.5-pro',
        responsePayload: {
          candidates: [{ content: { parts: [{ text: 'OK' }] } }],
        },
        verifyBody: (body) => {
          assert.ok(Array.isArray(body.contents))
          assert.deepEqual(body.generationConfig, { maxOutputTokens: 3000 })
        },
      },
      {
        endpointType: 'jina-rerank',
        expectedPath: '/v1/rerank',
        model: 'jina-reranker-v2-base-multilingual',
        responsePayload: {
          results: [{ index: 0, relevance_score: 0.99 }],
        },
        verifyBody: (body) => {
          assert.equal(body.top_n, 1)
          assert.ok(Array.isArray(body.documents))
        },
      },
      {
        endpointType: 'image-generation',
        expectedPath: '/v1/images/generations',
        model: 'dall-e-3',
        responsePayload: {
          data: [{ url: 'https://cdn.example.com/test.png' }],
        },
        verifyBody: (body) => {
          assert.equal(body.n, 1)
          assert.equal(body.size, '1024x1024')
        },
      },
      {
        endpointType: 'embeddings',
        expectedPath: '/v1/embeddings',
        model: 'text-embedding-3-small',
        responsePayload: {
          data: [{ index: 0, embedding: [0.1, 0.2] }],
        },
        verifyBody: (body) => {
          assert.ok(Array.isArray(body.input))
        },
      },
    ]

    for (const testCase of cases) {
      let requestedUrl = ''
      let requestedInit: RequestInit | undefined
      globalThis.fetch = (async (input, init) => {
        requestedUrl = String(input)
        requestedInit = init
        return new Response(JSON.stringify(testCase.responsePayload), {
          status: 200,
        })
      }) as typeof fetch

      const result = await testApiKeyModel(
        'https://api.example.com/v1',
        'sk-secret',
        testCase.model,
        testCase.endpointType
      )

      assert.equal(result.success, true)
      assert.equal(new URL(requestedUrl).pathname, testCase.expectedPath)
      assert.equal(requestedUrl.includes('sk-secret'), false)
      assert.equal(requestedInit?.method, 'POST')
      assert.equal(requestedInit?.credentials, 'omit')
      assert.equal(requestedInit?.cache, 'no-store')
      assert.equal(requestedInit?.redirect, 'error')

      const headers = new Headers(requestedInit?.headers)
      assert.equal(headers.get('Authorization'), 'Bearer sk-secret')
      assert.equal(headers.get('Content-Type'), 'application/json')
      testCase.verifyHeaders?.(headers)

      const body = JSON.parse(String(requestedInit?.body)) as Record<
        string,
        unknown
      >
      testCase.verifyBody(body)
    }
  })

  test('returns response metadata and a compact text preview', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '  OK\n' } }],
        }),
        {
          status: 200,
          headers: {
            'X-Oneapi-Request-Id': 'req-oneapi-123',
            'x-request-id': 'req-fallback-123',
          },
        }
      )) as typeof fetch

    const result = await testApiKeyModel(
      'https://api.example.com/v1',
      'sk-secret',
      'gpt-4o-mini',
      'openai'
    )

    assert.equal(result.success, true)
    if (!result.success) return
    assert.equal(result.endpointPath, '/v1/chat/completions')
    assert.equal(result.endpointType, 'openai')
    assert.equal(result.preview, 'OK')
    assert.equal(result.requestId, 'req-oneapi-123')
    assert.ok(result.responseTime >= 1)
  })

  test('rejects malformed successful responses for every endpoint', async () => {
    const cases: Array<{
      endpointType: ApiKeyTestEndpoint
      model: string
      responsePayload: unknown
    }> = [
      {
        endpointType: 'openai',
        model: 'gpt-4o-mini',
        responsePayload: { choices: [] },
      },
      {
        endpointType: 'openai-response',
        model: 'gpt-5.1',
        responsePayload: { output: [] },
      },
      {
        endpointType: 'openai-response-compact',
        model: 'gpt-5.1-compact',
        responsePayload: { output: null },
      },
      {
        endpointType: 'anthropic',
        model: 'claude-sonnet-4-5',
        responsePayload: { content: [] },
      },
      {
        endpointType: 'gemini',
        model: 'gemini-2.5-pro',
        responsePayload: { candidates: [] },
      },
      {
        endpointType: 'jina-rerank',
        model: 'jina-reranker-v2-base-multilingual',
        responsePayload: { results: [] },
      },
      {
        endpointType: 'image-generation',
        model: 'dall-e-3',
        responsePayload: { data: [] },
      },
      {
        endpointType: 'embeddings',
        model: 'text-embedding-3-small',
        responsePayload: { data: [] },
      },
    ]

    for (const testCase of cases) {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify(testCase.responsePayload), {
          status: 200,
          headers: { 'X-Oneapi-Request-Id': 'req-malformed-200' },
        })) as typeof fetch

      const result = await testApiKeyModel(
        'https://api.example.com/v1',
        'sk-secret',
        testCase.model,
        testCase.endpointType
      )

      assert.equal(result.success, false)
      if (result.success) continue
      assert.equal(result.failureKind, 'invalid-response')
      assert.equal(result.endpointType, testCase.endpointType)
      assert.equal(result.requestId, 'req-malformed-200')
      assert.equal(result.status, 200)
      assert.ok(result.responseTime != null && result.responseTime >= 1)
    }
  })

  test('preserves API errors and request identifiers from model tests', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: { message: 'Model is unavailable.' } }),
        { status: 503, headers: { 'x-request-id': 'req-failed-456' } }
      )) as typeof fetch

    const result = await testApiKeyModel(
      'https://api.example.com/v1',
      'sk-secret',
      'gpt-4o-mini',
      'openai'
    )

    assert.equal(result.success, false)
    if (result.success) return
    assert.equal(result.failureKind, 'api')
    assert.equal(result.message, 'Model is unavailable.')
    assert.equal(result.requestId, 'req-failed-456')
    assert.equal(result.status, 503)
    assert.equal(result.endpointPath, '/v1/chat/completions')
  })
})
