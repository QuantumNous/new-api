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
import { describe, expect, test } from 'vitest'

import {
  normalizeAdvancedCustomConfig,
  resolveAdvancedCustomTarget,
  stringifyAdvancedCustomConfig,
  validateAdvancedCustomConfig,
} from '../advanced-custom'

describe('advanced custom target', () => {
  test('maps legacy converter IDs to target on read', () => {
    const config = normalizeAdvancedCustomConfig({
      advanced_routes: [
        {
          incoming_path: '/v1/messages',
          upstream_path: '/v1/chat/completions',
          converter: 'anthropic_messages_to_openai_chat_completions',
        },
        {
          incoming_path: '/v1/chat/completions',
          upstream_path: '/v1/messages',
          converter: 'openai_chat_completions_to_anthropic_messages',
        },
      ],
    })

    const routes = config.advanced_routes ?? []
    expect(routes).toHaveLength(2)
    expect(resolveAdvancedCustomTarget(routes[0] ?? {})).toBe('chat')
    expect(resolveAdvancedCustomTarget(routes[1] ?? {})).toBe('claude')
    expect(routes[0]?.converter).toBeUndefined()
    expect(routes[0]?.target).toBe('chat')
    expect(stringifyAdvancedCustomConfig(config)).not.toContain('converter')
  })

  test('keeps an explicit target over a leftover converter ID', () => {
    const config = normalizeAdvancedCustomConfig({
      advanced_routes: [
        {
          incoming_path: '/v1/messages',
          upstream_path: '/v1beta/models/{model}:generateContent',
          target: 'gemini',
          converter: 'anthropic_messages_to_openai_chat_completions',
        },
      ],
    })
    expect(config.advanced_routes?.[0]?.target).toBe('gemini')
    expect(validateAdvancedCustomConfig(config)).toBeNull()
  })

  test('allows Claude incoming with Gemini target', () => {
    expect(
      validateAdvancedCustomConfig({
        advanced_routes: [
          {
            incoming_path: '/v1/messages',
            upstream_path: '/v1beta/models/{model}:generateContent',
            target: 'gemini',
          },
        ],
      })
    ).toBeNull()
  })

  test('rejects conversion targets on non-text incoming paths', () => {
    const error = validateAdvancedCustomConfig({
      advanced_routes: [
        {
          incoming_path: '/v1/images/generations',
          upstream_path: '/v1/chat/completions',
          target: 'chat',
        },
      ],
    })
    expect(error?.message).toBe(
      'Target format does not support this incoming path'
    )
  })
})
