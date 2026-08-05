import { describe, expect, it } from 'vitest'

import {
  parsePricingModels,
  parsePublicStatus,
  parseUptimeGroups,
  publicApi,
} from '@/api/public'
import { resetMockState, setMockDelay } from '@/api/mock/state'

import { afterEach, beforeEach } from 'vitest'

beforeEach(() => {
  resetMockState()
  setMockDelay(0)
})

afterEach(() => resetMockState())

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

  it('serves every public endpoint from the mock transport', async () => {
    const [status, notice, pricing, uptime] = await Promise.all([
      publicApi.status(),
      publicApi.notice(),
      publicApi.pricing(),
      publicApi.uptime(),
    ])

    expect(status.system_name).toBe('Ren2Hub')
    expect(notice).toContain('gpt-image-2')
    expect(pricing.length).toBeGreaterThan(0)
    expect(uptime[0]?.monitors[0]?.uptime).toBeGreaterThan(0.99)
  })
})
