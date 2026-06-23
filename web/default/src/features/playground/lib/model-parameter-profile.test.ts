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
import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../constants'
import type { Message, ParameterEnabled, PlaygroundConfig } from '../types'
import { resolveModelParameterKeys } from './model-parameter-profile'
import { buildChatCompletionPayload } from './payload-builder'

const userMessage: Message = {
  key: 'user-1',
  from: 'user',
  versions: [{ id: 'v1', content: 'Hello!' }],
}

const enabledParameters: ParameterEnabled = {
  ...DEFAULT_PARAMETER_ENABLED,
  max_tokens: true,
  seed: true,
}

function configFor(model: string): PlaygroundConfig {
  return {
    ...DEFAULT_CONFIG,
    model,
    group: 'plg',
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 1024,
    frequency_penalty: 0.2,
    presence_penalty: 0.3,
    seed: 1234,
    stream: true,
  }
}

describe('buildChatCompletionPayload model parameter profiles', () => {
  test('first-run minimal mode sends only core chat fields', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      configFor('gemini-2.5-flash'),
      enabledParameters,
      { minimalParameters: true }
    )

    expect(payload).toEqual({
      model: 'gemini-2.5-flash',
      group: 'plg',
      messages: [{ role: 'user', content: 'Hello!' }],
      stream: true,
    })
  })

  test('Claude-style models drop top_p and OpenAI-only penalties', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      configFor('anthropic/claude-sonnet-4.5'),
      enabledParameters
    )

    expect(payload.temperature).toBe(0.7)
    expect(payload.top_p).toBeUndefined()
    expect(payload.frequency_penalty).toBeUndefined()
    expect(payload.presence_penalty).toBeUndefined()
    expect(payload.max_tokens).toBe(1024)
    expect(payload.seed).toBeUndefined()
  })

  test('Claude Code models use the same conservative Claude profile', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      configFor('claude-code-sonnet-4'),
      enabledParameters
    )

    expect(payload.temperature).toBe(0.7)
    expect(payload.top_p).toBeUndefined()
    expect(payload.frequency_penalty).toBeUndefined()
    expect(payload.presence_penalty).toBeUndefined()
    expect(payload.seed).toBeUndefined()
  })

  test('Gemini models drop OpenAI-only penalties and seed', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      configFor('gemini-2.5-flash'),
      enabledParameters
    )

    expect(payload.temperature).toBe(0.7)
    expect(payload.top_p).toBeUndefined()
    expect(payload.frequency_penalty).toBeUndefined()
    expect(payload.presence_penalty).toBeUndefined()
    expect(payload.max_tokens).toBe(1024)
    expect(payload.seed).toBeUndefined()
  })

  test('OpenAI-compatible GPT models keep the wider supported parameter set', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      configFor('gpt-4o-mini'),
      enabledParameters
    )

    expect(payload.temperature).toBe(0.7)
    expect(payload.top_p).toBe(0.9)
    expect(payload.frequency_penalty).toBe(0.2)
    expect(payload.presence_penalty).toBe(0.3)
    expect(payload.max_tokens).toBe(1024)
    expect(payload.seed).toBe(1234)
  })

  test('OpenAI reasoning models drop incompatible chat-completion parameters', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      configFor('o3-mini'),
      enabledParameters
    )

    expect(payload.temperature).toBeUndefined()
    expect(payload.top_p).toBeUndefined()
    expect(payload.frequency_penalty).toBeUndefined()
    expect(payload.presence_penalty).toBeUndefined()
    expect(payload.max_tokens).toBeUndefined()
    expect(payload.max_completion_tokens).toBe(1024)
    expect(payload.seed).toBeUndefined()
  })

  test('provider-prefixed OpenAI reasoning models use max_completion_tokens only', () => {
    ;[
      'openai/o3-mini',
      'azure/o1-mini',
      'openrouter/o4-mini',
      'prod-o3-mini',
      'chat-o1-preview',
    ].forEach((model) => {
      const payload = buildChatCompletionPayload(
        [userMessage],
        configFor(model),
        enabledParameters
      )

      expect(payload.temperature).toBeUndefined()
      expect(payload.top_p).toBeUndefined()
      expect(payload.frequency_penalty).toBeUndefined()
      expect(payload.presence_penalty).toBeUndefined()
      expect(payload.max_tokens).toBeUndefined()
      expect(payload.max_completion_tokens).toBe(1024)
      expect(payload.seed).toBeUndefined()
    })
  })

  test('GPT-5 family models use max_completion_tokens only', () => {
    ;[
      'gpt-5',
      'gpt-5-mini',
      'openai/gpt-5',
      'azure/gpt-5-mini',
      'gpt-oss',
      'openai/gpt-oss-120b',
    ].forEach((model) => {
      const payload = buildChatCompletionPayload(
        [userMessage],
        configFor(model),
        enabledParameters
      )

      expect(payload.temperature).toBeUndefined()
      expect(payload.top_p).toBeUndefined()
      expect(payload.frequency_penalty).toBeUndefined()
      expect(payload.presence_penalty).toBeUndefined()
      expect(payload.max_tokens).toBeUndefined()
      expect(payload.max_completion_tokens).toBe(1024)
      expect(payload.seed).toBeUndefined()
    })
  })

  test('unknown models use conservative parameters', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      configFor('some-provider/custom-model'),
      enabledParameters
    )

    expect(payload.temperature).toBe(0.7)
    expect(payload.top_p).toBeUndefined()
    expect(payload.frequency_penalty).toBeUndefined()
    expect(payload.presence_penalty).toBeUndefined()
    expect(payload.max_tokens).toBe(1024)
    expect(payload.seed).toBeUndefined()
  })

  test('non-string model values use the conservative profile without throwing', () => {
    const payload = buildChatCompletionPayload(
      [userMessage],
      { ...configFor('gpt-4o-mini'), model: null as unknown as string },
      enabledParameters
    )

    expect(payload.temperature).toBe(0.7)
    expect(payload.top_p).toBeUndefined()
    expect(payload.frequency_penalty).toBeUndefined()
    expect(payload.presence_penalty).toBeUndefined()
    expect(payload.max_tokens).toBe(1024)
    expect(payload.seed).toBeUndefined()
  })

  test('resolved parameter keys are isolated from caller mutation', () => {
    const keys = resolveModelParameterKeys('gpt-4o-mini')
    keys.splice(0, keys.length)

    expect(resolveModelParameterKeys('gpt-4o-mini')).toContain('temperature')
    expect(resolveModelParameterKeys('gpt-4o-mini')).toContain('seed')
  })
})
