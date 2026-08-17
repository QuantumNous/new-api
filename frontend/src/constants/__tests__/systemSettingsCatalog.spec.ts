import { describe, expect, it } from 'vitest'
import { SYSTEM_SETTINGS_DOMAINS } from '@/constants/systemSettingsCatalog'

describe('system settings catalog', () => {
  it('provides a stable default deep link for every top-level domain', () => {
    expect(SYSTEM_SETTINGS_DOMAINS.map((domain) => domain.id)).toEqual([
      'site',
      'auth',
      'billing',
      'models',
      'security',
      'content',
      'operations',
    ])

    for (const domain of SYSTEM_SETTINGS_DOMAINS) {
      expect(
        domain.sections.some((section) => section.id === domain.defaultSection)
      ).toBe(true)
    }
  })

  it('maps each option key to one visible administration section', () => {
    const keys = SYSTEM_SETTINGS_DOMAINS.flatMap((domain) =>
      domain.sections.flatMap((section) => section.fields.map((field) => field.key))
    )

    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('HeaderNavModules')
    expect(keys).toContain('ModelRequestRateLimitGroup')
    expect(keys).toContain('WorkerAllowHttpImageRequestEnabled')
    expect(keys).toContain('perf_metrics_setting.retention_days')
  })

  it('uses structured editors for pricing, lists, and Waffo Pancake setup', () => {
    const sections = SYSTEM_SETTINGS_DOMAINS.flatMap((domain) => domain.sections)
    const pricing = sections.find((section) => section.id === 'pricing')
    const ssrf = sections.find((section) => section.id === 'ssrf')
    const waffoPancake = sections.find((section) => section.id === 'waffo-pancake')

    expect(pricing?.fields.find((field) => field.key === 'ModelRatio')?.kind).toBe(
      'ratio'
    )
    expect(
      ssrf?.fields.find((field) => field.key === 'fetch_setting.domain_list')?.kind
    ).toBe('list')
    expect(waffoPancake?.integration).toBe('waffo-pancake')
  })
})
