import { describe, expect, it } from 'vitest'

import { toGlobalRoutingPreferences } from '../routing-preferences'

describe('toGlobalRoutingPreferences', () => {
  it('persists one global rule instead of model-specific rules', () => {
    const values = {
      mode: 'throughput' as const,
      allow_fallbacks: true,
      max_attempts: 4,
      max_price: 0.2,
      min_quality_score: 0.7,
      preference_version: 'global-v1',
    }

    expect(toGlobalRoutingPreferences(values)).toEqual({ '*': values })
  })
})
