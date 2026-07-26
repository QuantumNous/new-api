import { describe, expect, it } from 'vitest'

import {
  getLogExportValues,
  LOG_EXPORT_HEADERS,
} from '@/components/console/log-ui/logExport'
import type { LogItem } from '@/types/console'

const log: LogItem = {
  id: 1,
  type: 'consume',
  token_name: 'Export key',
  model: 'gpt-4o',
  channel: 'OpenAI',
  prompt_tokens: 1,
  completion_tokens: 2,
  cache_read_tokens: 3,
  cache_write_tokens: 4,
  cache_ttl: '5m',
  quota: 3,
  latency: 4.5,
  first_token_latency: 1.25,
  request_mode: 'stream',
  tps: 5,
  content: 'done',
  created: 1_752_000_000,
}

describe('log exports', () => {
  it('exports request timing and cache fields in the token field group', () => {
    expect(LOG_EXPORT_HEADERS).toEqual([
      'time',
      'token',
      'type',
      'model',
      'channel',
      'request_mode',
      'first_token_latency',
      'prompt_tokens',
      'completion_tokens',
      'cache_read_tokens',
      'cache_write_tokens',
      'cache_ttl',
      'latency',
      'tps',
      'quota',
      'content',
    ])
    expect(getLogExportValues(log)).toEqual([
      expect.any(String),
      'Export key',
      'consume',
      'gpt-4o',
      'OpenAI',
      'stream',
      1.25,
      1,
      2,
      3,
      4,
      '5m',
      4.5,
      5,
      3,
      'done',
    ])
  })
})
