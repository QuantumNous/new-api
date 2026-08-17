import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearAffiliateAttribution,
  getAffiliateAttribution,
  storeAffiliateAttribution,
} from '@/utils/affiliate'

describe('affiliate attribution storage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-17T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the last validated attribution for 30 days', () => {
    storeAffiliateAttribution('FIRST')
    storeAffiliateAttribution('SECOND')

    expect(getAffiliateAttribution()).toBe('SECOND')
    vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000 + 1)
    expect(getAffiliateAttribution()).toBe('')
  })

  it('clears attribution after registration or login', () => {
    storeAffiliateAttribution('INVITE01')
    clearAffiliateAttribution()
    expect(getAffiliateAttribution()).toBe('')
  })
})
