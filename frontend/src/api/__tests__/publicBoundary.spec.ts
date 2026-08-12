import { describe, expect, it } from 'vitest'

import {
  parseHomeRequestMetrics,
  parsePricingModels,
  parsePublicStatus,
  parseUptimeGroups,
} from '@/api/public'

describe('public API response boundaries', () => {
  it('normalizes valid public response data', () => {
    expect(
      parsePublicStatus({
        system_name: 'Ren2Hub',
        register_enabled: false,
        HeaderNavModules: '{"pricing":true}',
      })
    ).toEqual({
      system_name: 'Ren2Hub',
      register_enabled: false,
      HeaderNavModules: '{"pricing":true}',
    })
    expect(parsePricingModels([{ model_name: 'gpt-4o' }])).toEqual([
      { model_name: 'gpt-4o' },
    ])
    expect(
      parseUptimeGroups([{ monitors: [{ uptime: 0.99, status: 1 }] }])
    ).toEqual([{ monitors: [{ uptime: 0.99, status: 1 }] }])
  })

  it('rejects malformed public response data', () => {
    expect(() => parsePublicStatus({ system_name: 123 })).toThrow()
    expect(() => parsePricingModels({ model_name: 'gpt-4o' })).toThrow()
    expect(() => parsePricingModels([{ id: 1 }])).toThrow()
    expect(() =>
      parseUptimeGroups([{ monitors: [{ uptime: 'offline', status: 0 }] }])
    ).toThrow()
  })

  it('accepts only a consistent 24-hour metrics snapshot', () => {
    const hourly = Array.from({ length: 24 }, (_, index) => index)
    expect(
      parseHomeRequestMetrics({
        available: true,
        requests_24h: 276,
        hourly_requests: hourly,
        generated_at: 1_700_000_000,
      })
    ).toEqual({
      available: true,
      requests_24h: 276,
      hourly_requests: hourly,
      generated_at: 1_700_000_000,
    })
    expect(
      parseHomeRequestMetrics({
        available: false,
        requests_24h: null,
        hourly_requests: Array(24).fill(0),
        generated_at: 1_700_000_000,
      }).requests_24h
    ).toBeNull()
  })

  it('rejects invalid metrics buckets, totals, and availability states', () => {
    const valid = {
      available: true,
      requests_24h: 24,
      hourly_requests: Array(24).fill(1),
      generated_at: 1_700_000_000,
    }
    expect(() =>
      parseHomeRequestMetrics({ ...valid, hourly_requests: Array(23).fill(1) })
    ).toThrow()
    expect(() =>
      parseHomeRequestMetrics({
        ...valid,
        hourly_requests: [-1, ...Array(23).fill(1)],
      })
    ).toThrow()
    expect(() =>
      parseHomeRequestMetrics({ ...valid, requests_24h: 23 })
    ).toThrow()
    expect(() =>
      parseHomeRequestMetrics({ ...valid, available: false })
    ).toThrow()
    expect(() =>
      parseHomeRequestMetrics({
        ...valid,
        available: false,
        requests_24h: null,
      })
    ).toThrow()
    expect(() =>
      parseHomeRequestMetrics({
        ...valid,
        requests_24h: Number.MAX_SAFE_INTEGER + 1,
      })
    ).toThrow()
    expect(() =>
      parseHomeRequestMetrics({
        ...valid,
        hourly_requests: [Number.MAX_SAFE_INTEGER + 1, ...Array(23).fill(0)],
        requests_24h: Number.MAX_SAFE_INTEGER,
      })
    ).toThrow()
    expect(() =>
      parseHomeRequestMetrics({
        ...valid,
        generated_at: Number.MAX_SAFE_INTEGER + 1,
      })
    ).toThrow()
  })
})
