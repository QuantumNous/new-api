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

import type { Message } from '../../types'
import { DEFAULT_PARAMETER_ENABLED } from '../../constants'
import { buildChatCompletionPayload } from '../streaming/payload-builder'

const messages: Message[] = [
  { key: 'm1', from: 'user', versions: [{ id: 'v1', content: 'hello' }] },
]

describe('buildChatCompletionPayload search option', () => {
  test('adds web_search_options when search is enabled', () => {
    const payload = buildChatCompletionPayload(
      messages,
      {
        model: 'gpt-4o',
        group: 'default',
        temperature: 0.7,
        top_p: 1,
        max_tokens: 4096,
        frequency_penalty: 0,
        presence_penalty: 0,
        seed: null,
        stream: true,
        searchEnabled: true,
      },
      DEFAULT_PARAMETER_ENABLED
    )

    expect(payload.web_search_options).toEqual({
      search_context_size: 'medium',
    })
  })

  test('omits web_search_options when search is disabled or unset', () => {
    const baseConfig = {
      model: 'gpt-4o',
      group: 'default',
      temperature: 0.7,
      top_p: 1,
      max_tokens: 4096,
      frequency_penalty: 0,
      presence_penalty: 0,
      seed: null,
      stream: true,
    }

    const disabledPayload = buildChatCompletionPayload(
      messages,
      { ...baseConfig, searchEnabled: false },
      DEFAULT_PARAMETER_ENABLED
    )
    const unsetPayload = buildChatCompletionPayload(
      messages,
      baseConfig,
      DEFAULT_PARAMETER_ENABLED
    )

    expect(disabledPayload.web_search_options).toBeUndefined()
    expect(unsetPayload.web_search_options).toBeUndefined()
  })
})
