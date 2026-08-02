import { describe, expect, it } from 'vitest'

import { getLogMetadata } from '@/components/console/log-ui/logMetadata'
import type { LogItem } from '@/types/console'

const baseLog = {
  id: 1,
  type: 'consume',
  token_name: 'key',
  model: 'model',
  channel: 'channel',
  prompt_tokens: 1,
  completion_tokens: 1,
  quota: 0,
  latency: 1,
  first_token_latency: null,
  request_mode: 'sync',
  tps: 1,
  content: 'ok',
  created: 1,
} satisfies LogItem

describe('log metadata', () => {
  it('normalizes known reasoning efforts and preserves unknown values', () => {
    expect(
      getLogMetadata({
        ...baseLog,
        other: JSON.stringify({ reasoning_effort: 'xhigh' }),
      }).reasoningEffort
    ).toBe('xHigh')
    expect(
      getLogMetadata({
        ...baseLog,
        other: { reasoning_effort: 'experimental' },
      }).reasoningEffort
    ).toBe('experimental')
  })

  it('recognizes all Fast signals but never truthy false values', () => {
    expect(
      getLogMetadata({ ...baseLog, other: { fast_mode: true } }).fastMode
    ).toBe(true)
    expect(
      getLogMetadata({ ...baseLog, other: { service_tier: ' FAST ' } }).fastMode
    ).toBe(true)
    expect(getLogMetadata({ ...baseLog, speed: 'fast' }).fastMode).toBe(true)
    expect(
      getLogMetadata({ ...baseLog, other: { fast_mode: false, speed: 'fast' } })
        .fastMode
    ).toBe(false)
    expect(getLogMetadata({ ...baseLog, other: '{bad json' }).fastMode).toBe(
      false
    )
  })
})
