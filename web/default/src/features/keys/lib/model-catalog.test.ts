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

import type { ApiKeyModel, ApiKeyModelEndpoint } from '../api'
import { groupCCSwitchModels } from './model-catalog'

function model(
  id: string,
  endpoints: ApiKeyModelEndpoint[],
  ownedBy?: string
): ApiKeyModel {
  return { id, ownedBy, supportedEndpointTypes: endpoints }
}

function idsByGroup(
  models: ApiKeyModel[],
  app: 'claude' | 'codex' | 'gemini',
  field: 'model' | 'haikuModel' | 'sonnetModel' | 'opusModel' = 'model',
  search = ''
): Record<string, string[]> {
  return Object.fromEntries(
    groupCCSwitchModels(models, app, field, search).map((group) => [
      group.kind,
      group.models.map((item) => item.id),
    ])
  )
}

describe('CC Switch model catalog grouping', () => {
  const models = [
    model('claude-sonnet-4-6', ['anthropic'], 'Anthropic'),
    model('gpt-5.6-sol', ['openai'], 'OpenAI'),
    model('gemini-3-pro', ['gemini', 'openai'], 'Google'),
    model('codex-native', ['openai-response'], 'OpenAI'),
    model('response-compact', ['openai-response-compact'], 'OpenAI'),
    model('image-model', ['image-generation', 'openai'], 'OpenAI'),
    model('video-model', ['openai-video'], 'OpenAI'),
  ]

  test('keeps every key-scoped model while only changing presentation groups', () => {
    for (const app of ['claude', 'codex', 'gemini'] as const) {
      const groups = groupCCSwitchModels(models, app, 'model')
      const renderedIds = groups.flatMap((group) =>
        group.models.map((item) => item.id)
      )

      assert.equal(new Set(renderedIds).size, models.length)
      assert.deepEqual(
        new Set(renderedIds),
        new Set(models.map((item) => item.id))
      )
    }
  })

  test('uses endpoint metadata only as protocol and gateway hints', () => {
    const claude = idsByGroup(models, 'claude')
    assert.deepEqual(claude.protocol, ['claude-sonnet-4-6'])
    assert.deepEqual(claude.gateway, ['gpt-5.6-sol', 'gemini-3-pro'])

    const codex = idsByGroup(models, 'codex')
    assert.deepEqual(codex.protocol, ['codex-native'])
    assert.deepEqual(codex.gateway, [
      'gpt-5.6-sol',
      'claude-sonnet-4-6',
      'gemini-3-pro',
    ])

    const gemini = idsByGroup(models, 'gemini')
    assert.deepEqual(gemini.protocol, ['gemini-3-pro'])
    assert.deepEqual(gemini.gateway, ['claude-sonnet-4-6', 'gpt-5.6-sol'])
  })

  test('keeps compact and specialized endpoints in the other group', () => {
    for (const app of ['claude', 'codex', 'gemini'] as const) {
      const other = idsByGroup(models, app).other
      assert.ok(other.includes('response-compact'))
      assert.ok(other.includes('image-model'))
      assert.ok(other.includes('video-model'))
    }
  })

  test('prioritizes the current Claude field family and otherwise stays stable', () => {
    const claudeModels = [
      model('claude-opus-4', ['anthropic']),
      model('claude-sonnet-4', ['anthropic']),
      model('claude-haiku-4', ['anthropic']),
      model('claude-haiku-3', ['anthropic']),
    ]

    assert.deepEqual(
      idsByGroup(claudeModels, 'claude', 'haikuModel').protocol,
      ['claude-haiku-4', 'claude-haiku-3', 'claude-opus-4', 'claude-sonnet-4']
    )
  })

  test('searches model ID, owner, and endpoint with exact matches first', () => {
    const searchable = [
      model('foo-openai', ['openai'], 'Vendor'),
      model('openai', ['openai'], 'OpenAI'),
      model('claude-proxy', ['anthropic'], 'OpenAI Partner'),
    ]

    assert.deepEqual(idsByGroup(searchable, 'codex', 'model', 'openai'), {
      protocol: [],
      gateway: ['openai', 'foo-openai', 'claude-proxy'],
      other: [],
    })
  })
})
