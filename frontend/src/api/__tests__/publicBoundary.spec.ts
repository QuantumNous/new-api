import { describe, expect, it } from 'vitest'

import {
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
})
