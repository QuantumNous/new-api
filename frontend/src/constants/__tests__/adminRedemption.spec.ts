import { describe, expect, it } from 'vitest'

import {
  ADMIN_REDEMPTION_TYPES,
  formatRedemptionValue,
} from '@/constants/adminRedemption'

describe('admin redemption contract', () => {
  it('only exposes quota redemption codes', () => {
    expect(ADMIN_REDEMPTION_TYPES).toEqual(['quota'])
  })

  it('formats the real quota value without plan or concurrency branches', () => {
    expect(formatRedemptionValue({ amount: 5, quota: 2_500_000 })).toBe('$5.00')
    expect(formatRedemptionValue({ amount: 0, quota: 500_000 })).toBe('$1.00')
  })
})
