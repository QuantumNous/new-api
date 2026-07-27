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
  getApiKeyModelCatalogQueryKey,
  type ApiKeyModelCatalogScope,
} from './use-api-key-model-catalog'

function apiKeyScope(
  overrides: Partial<ApiKeyModelCatalogScope> = {}
): ApiKeyModelCatalogScope {
  return {
    id: 1,
    group: 'auto',
    group_candidates: ['openai-low', 'claude-low'],
    model_limits_enabled: false,
    model_limits: '',
    ...overrides,
  }
}

describe('API key model catalog query identity', () => {
  test('normalizes the base URL and preserves candidate group order', () => {
    const queryKey = getApiKeyModelCatalogQueryKey(
      '  https://api.example.com/v1///  ',
      apiKeyScope()
    )

    assert.deepEqual(queryKey, [
      'api-key-model-catalog',
      'https://api.example.com/v1',
      1,
      'auto',
      ['openai-low', 'claude-low'],
      false,
      '',
    ])
  })

  test('isolates API keys and ordered routing configurations', () => {
    const keyA = getApiKeyModelCatalogQueryKey(
      'https://api.example.com/v1',
      apiKeyScope({ id: 1 })
    )
    const keyB = getApiKeyModelCatalogQueryKey(
      'https://api.example.com/v1',
      apiKeyScope({ id: 2 })
    )
    const reversedCandidates = getApiKeyModelCatalogQueryKey(
      'https://api.example.com/v1',
      apiKeyScope({ group_candidates: ['claude-low', 'openai-low'] })
    )

    assert.notDeepEqual(keyA, keyB)
    assert.notDeepEqual(keyA, reversedCandidates)
  })

  test('isolates base URL, group, and model limit changes', () => {
    const baseline = getApiKeyModelCatalogQueryKey(
      'https://api-a.example.com/v1',
      apiKeyScope()
    )
    const changedKeys = [
      getApiKeyModelCatalogQueryKey(
        'https://api-b.example.com/v1',
        apiKeyScope()
      ),
      getApiKeyModelCatalogQueryKey(
        'https://api-a.example.com/v1',
        apiKeyScope({ group: 'openai-low' })
      ),
      getApiKeyModelCatalogQueryKey(
        'https://api-a.example.com/v1',
        apiKeyScope({ model_limits_enabled: true })
      ),
      getApiKeyModelCatalogQueryKey(
        'https://api-a.example.com/v1',
        apiKeyScope({ model_limits: 'gpt-5.6-sol' })
      ),
    ]

    for (const changedKey of changedKeys) {
      assert.notDeepEqual(baseline, changedKey)
    }
  })

  test('never includes the real API key in the cache identity', () => {
    const secret = 'sk-super-secret-value'
    const apiKeyWithSecret = { ...apiKeyScope(), key: secret }
    const queryKey = getApiKeyModelCatalogQueryKey(
      'https://api.example.com/v1',
      apiKeyWithSecret
    )

    assert.equal(JSON.stringify(queryKey).includes(secret), false)
  })
})
