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

import type { UsageLog } from '../../data/schema'
import { getUsageTokenBreakdown } from '../format'

function usageLog(overrides: Partial<UsageLog> = {}): UsageLog {
  return {
    id: 1,
    user_id: 1,
    created_at: 0,
    type: 2,
    content: '',
    username: '',
    token_name: '',
    model_name: 'kimi-for-coding',
    quota: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    use_time: 0,
    is_stream: true,
    channel: 1,
    channel_name: '',
    token_id: 1,
    group: '',
    ip: '',
    other: '',
    request_id: '',
    upstream_request_id: '',
    ...overrides,
  }
}

describe('usage token breakdown', () => {
  test('keeps a fully cached Claude-compatible request visible', () => {
    const result = getUsageTokenBreakdown(usageLog(), {
      claude: true,
      cache_tokens: 516700,
    })

    expect(result).toMatchObject({
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 516700,
      hasTokens: true,
      usesClaudeSemantics: true,
    })
  })

  test('prefers the normalized cache-write total when split fields differ', () => {
    const result = getUsageTokenBreakdown(usageLog(), {
      cache_write_tokens: 80,
      cache_creation_tokens: 70,
      cache_creation_tokens_5m: 20,
      cache_creation_tokens_1h: 30,
    })

    expect(result.cacheWriteTokens).toBe(80)
    expect(result.cacheWrite5mTokens).toBe(20)
    expect(result.cacheWrite1hTokens).toBe(30)
  })

  test('does not apply Claude labels to OpenAI-compatible usage', () => {
    const result = getUsageTokenBreakdown(
      usageLog({ prompt_tokens: 120, completion_tokens: 10 }),
      { cache_tokens: 40 }
    )

    expect(result).toMatchObject({
      promptTokens: 120,
      completionTokens: 10,
      cacheReadTokens: 40,
      hasTokens: true,
      usesClaudeSemantics: false,
    })
  })
})
