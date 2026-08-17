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
  buildClaudeCodeSnippet,
  buildOpenCodeSnippet,
  formatGatewayApiKey,
  normalizeGatewayBaseUrl,
  openaiCompatibleBaseUrl,
  OPENCODE_PROVIDER_ID,
  pickDefaultQuickSetupModel,
  QUICK_SETUP_API_KEY_PLACEHOLDER,
  resolveGatewayServerAddress,
} from '../quick-setup'

describe('normalizeGatewayBaseUrl', () => {
  test('strips trailing slashes from an origin', () => {
    assert.equal(
      normalizeGatewayBaseUrl('https://api.example.com///'),
      'https://api.example.com'
    )
  })
})

describe('openaiCompatibleBaseUrl', () => {
  test('appends /v1 when the origin has no version suffix', () => {
    assert.equal(
      openaiCompatibleBaseUrl('https://api.example.com'),
      'https://api.example.com/v1'
    )
  })

  test('does not double an existing /v1 suffix', () => {
    assert.equal(
      openaiCompatibleBaseUrl('https://api.example.com/v1/'),
      'https://api.example.com/v1'
    )
  })
})

describe('formatGatewayApiKey', () => {
  test('prefixes sk- when the stored token has no prefix', () => {
    assert.equal(formatGatewayApiKey('abc123'), 'sk-abc123')
  })

  test('leaves an already-prefixed key unchanged', () => {
    assert.equal(formatGatewayApiKey('sk-abc123'), 'sk-abc123')
  })
})

describe('pickDefaultQuickSetupModel', () => {
  test('prefers a Claude Sonnet 4 model when several models are available', () => {
    assert.equal(
      pickDefaultQuickSetupModel([
        'gpt-4.1',
        'claude-opus-4',
        'claude-sonnet-4-6',
      ]),
      'claude-sonnet-4-6'
    )
  })

  test('returns an empty string when the model list is empty', () => {
    assert.equal(pickDefaultQuickSetupModel([]), '')
  })
})

describe('resolveGatewayServerAddress', () => {
  test('uses server_address from status when present', () => {
    assert.equal(
      resolveGatewayServerAddress({
        server_address: 'https://gw.example.com/',
      }),
      'https://gw.example.com'
    )
  })
})

describe('buildClaudeCodeSnippet', () => {
  test('settings snippet omits /v1 and pins every Claude Code alias to the picked model', () => {
    const snippet = buildClaudeCodeSnippet({
      baseUrl: 'https://gw.example.com/',
      apiKey: 'abc123',
      model: 'my-sonnet',
      format: 'settings',
    })
    const parsed = JSON.parse(snippet) as {
      env: Record<string, string>
    }

    assert.equal(parsed.env.ANTHROPIC_BASE_URL, 'https://gw.example.com')
    assert.equal(parsed.env.ANTHROPIC_AUTH_TOKEN, 'sk-abc123')
    assert.equal(parsed.env.ANTHROPIC_MODEL, 'my-sonnet')
    assert.equal(parsed.env.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'my-sonnet')
    assert.equal(parsed.env.ANTHROPIC_DEFAULT_SONNET_MODEL, 'my-sonnet')
    assert.equal(parsed.env.ANTHROPIC_DEFAULT_OPUS_MODEL, 'my-sonnet')
    assert.equal(parsed.env.ANTHROPIC_DEFAULT_FABLE_MODEL, 'my-sonnet')
  })

  test('shell snippet exports the same gateway values', () => {
    const snippet = buildClaudeCodeSnippet({
      baseUrl: 'https://gw.example.com',
      apiKey: 'sk-abc123',
      model: 'my-sonnet',
      format: 'shell',
    })

    assert.match(snippet, /export ANTHROPIC_BASE_URL='https:\/\/gw\.example\.com'/)
    assert.match(snippet, /export ANTHROPIC_AUTH_TOKEN='sk-abc123'/)
    assert.match(snippet, /export ANTHROPIC_DEFAULT_HAIKU_MODEL='my-sonnet'/)
  })
})

describe('buildOpenCodeSnippet', () => {
  test('writes an OpenAI-compatible provider pointed at /v1 with the picked model', () => {
    const snippet = buildOpenCodeSnippet({
      baseUrl: 'https://gw.example.com',
      apiKey: 'sk-abc123',
      model: 'my-sonnet',
    })
    const parsed = JSON.parse(snippet) as {
      model: string
      provider: Record<
        string,
        {
          options: { baseURL: string; apiKey: string }
          models: Record<string, { name: string }>
        }
      >
    }

    assert.equal(parsed.model, `${OPENCODE_PROVIDER_ID}/my-sonnet`)
    assert.equal(
      parsed.provider[OPENCODE_PROVIDER_ID]?.options.baseURL,
      'https://gw.example.com/v1'
    )
    assert.equal(
      parsed.provider[OPENCODE_PROVIDER_ID]?.options.apiKey,
      'sk-abc123'
    )
    assert.equal(
      parsed.provider[OPENCODE_PROVIDER_ID]?.models['my-sonnet']?.name,
      'my-sonnet'
    )
    assert.doesNotMatch(snippet, new RegExp(QUICK_SETUP_API_KEY_PLACEHOLDER))
  })
})
