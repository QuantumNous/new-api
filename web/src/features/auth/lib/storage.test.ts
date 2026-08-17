import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearAffiliateCode,
  getAffiliateCode,
  saveAffiliateCode,
} from './storage'

describe('affiliate attribution storage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-17T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses 30-day last-touch attribution', () => {
    saveAffiliateCode('FIRST')
    saveAffiliateCode('SECOND')

    expect(getAffiliateCode()).toBe('SECOND')
    vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000 + 1)
    expect(getAffiliateCode()).toBe('')
  })

  it('removes both current and legacy keys', () => {
    saveAffiliateCode('INVITE01')
    localStorage.setItem('aff', 'LEGACY')
    clearAffiliateCode()

    expect(getAffiliateCode()).toBe('')
    expect(localStorage.getItem('aff')).toBeNull()
  })
})
