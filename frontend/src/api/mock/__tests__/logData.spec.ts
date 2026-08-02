import { describe, expect, it } from 'vitest'

import { logs } from '@/api/mock/data'

describe('mock log usage data', () => {
  it('covers stream and sync request modes with cache combinations', () => {
    expect(logs.some((log) => log.request_mode === 'stream')).toBe(true)
    expect(logs.some((log) => log.request_mode === 'sync')).toBe(true)
    expect(
      logs.some(
        (log) =>
          log.cache_read_tokens !== null &&
          log.cache_read_tokens !== undefined &&
          log.cache_write_tokens !== null &&
          log.cache_write_tokens !== undefined &&
          log.cache_ttl
      )
    ).toBe(true)
    expect(
      logs.some(
        (log) =>
          log.request_mode !== null &&
          log.cache_read_tokens == null &&
          log.cache_write_tokens == null
      )
    ).toBe(true)
  })

  it('keeps cache fields unavailable for non-request logs', () => {
    expect(
      logs
        .filter((log) => log.request_mode === null)
        .every(
          (log) =>
            log.cache_read_tokens === null &&
            log.cache_write_tokens === null &&
            log.cache_ttl === null
        )
    ).toBe(true)
  })

  it('covers reasoning efforts and Fast compatibility signals', () => {
    const requestLogs = logs.filter((log) => log.request_mode !== null)
    const efforts = new Set(
      requestLogs.map((log) => JSON.parse(String(log.other)).reasoning_effort)
    )
    expect(efforts).toEqual(new Set(['low', 'medium', 'high', 'xhigh', 'max']))
    expect(
      requestLogs.some(
        (log) => JSON.parse(String(log.other)).fast_mode === true
      )
    ).toBe(true)
    expect(
      requestLogs.some(
        (log) => JSON.parse(String(log.other)).service_tier === 'fast'
      )
    ).toBe(true)
    expect(requestLogs.some((log) => log.speed === 'fast')).toBe(true)
    expect(
      requestLogs.some(
        (log) => JSON.parse(String(log.other)).fast_mode === false
      )
    ).toBe(true)
  })
})
