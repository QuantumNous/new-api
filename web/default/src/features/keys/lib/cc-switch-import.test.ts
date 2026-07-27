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

import { buildCCSwitchImportUrl } from './cc-switch-import'

describe('CC Switch import URL', () => {
  test('encodes every application endpoint and model mapping correctly', () => {
    const cases = [
      {
        app: 'claude' as const,
        apiKey: 'raw-token',
        expectedApiKey: 'sk-raw-token',
        expectedEndpoint: 'https://api.example.com',
        models: {
          model: 'claude-opus-4-8',
          haikuModel: 'claude-haiku-4-5',
          sonnetModel: '',
        },
      },
      {
        app: 'codex' as const,
        apiKey: 'sk-existing-token',
        expectedApiKey: 'sk-existing-token',
        expectedEndpoint: 'https://api.example.com/v1',
        models: { model: 'gpt-5.6-sol' },
      },
      {
        app: 'gemini' as const,
        apiKey: 'gemini-token',
        expectedApiKey: 'sk-gemini-token',
        expectedEndpoint: 'https://api.example.com',
        models: { model: 'gemini-3-pro' },
      },
    ]

    for (const item of cases) {
      const url = new URL(
        buildCCSwitchImportUrl({
          apiKey: item.apiKey,
          app: item.app,
          models: item.models,
          name: '配置 & test',
          serverAddress: ' https://api.example.com/ ',
        })
      )

      assert.equal(url.protocol, 'ccswitch:')
      assert.equal(url.pathname, '/import')
      assert.equal(url.searchParams.get('resource'), 'provider')
      assert.equal(url.searchParams.get('app'), item.app)
      assert.equal(url.searchParams.get('name'), '配置 & test')
      assert.equal(url.searchParams.get('endpoint'), item.expectedEndpoint)
      assert.equal(url.searchParams.get('homepage'), 'https://api.example.com')
      assert.equal(url.searchParams.get('apiKey'), item.expectedApiKey)
      assert.equal(url.searchParams.get('enabled'), 'true')
      assert.equal(url.searchParams.get('model'), item.models.model)
      assert.equal(url.searchParams.has('sonnetModel'), false)
      assert.equal(url.searchParams.has('group'), false)
      assert.equal(url.searchParams.has('group_candidates'), false)
    }
  })
})
