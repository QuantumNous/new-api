import { describe, expect, it } from 'vitest'

import {
  ADMIN_ORDER_DEFAULT_RANGE,
  ADMIN_ORDER_METHODS,
  ADMIN_ORDER_RANGES,
  ADMIN_ORDER_SORT_FIELDS,
  ADMIN_ORDER_STATUSES,
  ADMIN_ORDER_TYPES,
  adminOrderMethodLabelKey,
  adminOrderRankStyle,
  adminOrderStatusLabelKey,
  adminOrderStatusTone,
  adminOrderTypeLabelKey,
  canRefundAdminOrder,
  isAdminOrderRange,
} from '@/constants/adminOrders'

describe('admin order enums', () => {
  it('covers the full payment lifecycle', () => {
    expect(ADMIN_ORDER_STATUSES).toEqual([
      'completed',
      'pending',
      'cancelled',
      'expired',
      'refunded',
    ])
  })

  it('lists the three sellable paths and four payment channels', () => {
    expect(ADMIN_ORDER_TYPES).toEqual(['topup', 'subscription', 'market'])
    expect(ADMIN_ORDER_METHODS).toEqual(['alipay', 'wechat', 'stripe', 'creem'])
  })

  it('only sorts on numeric columns', () => {
    expect(ADMIN_ORDER_SORT_FIELDS).toEqual(['id', 'amount', 'created'])
  })
})

describe('statistics range', () => {
  it('offers ascending trailing windows with a 30-day default', () => {
    expect(ADMIN_ORDER_RANGES).toEqual([7, 30, 90])
    expect(ADMIN_ORDER_DEFAULT_RANGE).toBe(30)
    expect(ADMIN_ORDER_RANGES).toContain(ADMIN_ORDER_DEFAULT_RANGE)
  })

  it('accepts the presets in numeric and string form, rejects anything else', () => {
    expect(isAdminOrderRange(7)).toBe(true)
    expect(isAdminOrderRange('30')).toBe(true)
    expect(isAdminOrderRange(90)).toBe(true)
    expect(isAdminOrderRange(31)).toBe(false)
    expect(isAdminOrderRange('')).toBe(false)
    expect(isAdminOrderRange(undefined)).toBe(false)
    expect(isAdminOrderRange('abc')).toBe(false)
  })
})

describe('status presentation', () => {
  it('colours revenue states and leaves non-revenue states neutral', () => {
    expect(adminOrderStatusTone('completed')).toBe('success')
    expect(adminOrderStatusTone('pending')).toBe('warning')
    expect(adminOrderStatusTone('refunded')).toBe('info')
    expect(adminOrderStatusTone('cancelled')).toBe('neutral')
    expect(adminOrderStatusTone('expired')).toBe('neutral')
  })

  it('maps every enum member to a label key', () => {
    ADMIN_ORDER_STATUSES.forEach((status) => {
      expect(adminOrderStatusLabelKey(status)).toBe(`orders.status.${status}`)
    })
    ADMIN_ORDER_TYPES.forEach((type) => {
      expect(adminOrderTypeLabelKey(type)).toBe(`orders.type.${type}`)
    })
    ADMIN_ORDER_METHODS.forEach((method) => {
      expect(adminOrderMethodLabelKey(method)).toBe(`orders.method.${method}`)
    })
  })
})

describe('canRefundAdminOrder', () => {
  it('allows only a completed order', () => {
    expect(canRefundAdminOrder({ status: 'completed' })).toBe(true)
  })

  it('refuses every state that never took money or already returned it', () => {
    expect(canRefundAdminOrder({ status: 'pending' })).toBe(false)
    expect(canRefundAdminOrder({ status: 'cancelled' })).toBe(false)
    expect(canRefundAdminOrder({ status: 'expired' })).toBe(false)
    // Already refunded — a second refund would double-reverse the quota.
    expect(canRefundAdminOrder({ status: 'refunded' })).toBe(false)
  })
})

describe('adminOrderRankStyle', () => {
  it('gives the podium three distinct token-backed fills', () => {
    const podium = [1, 2, 3].map((rank) => adminOrderRankStyle(rank).background)
    // Second place is --signal-strong, not --signal: measured in the browser,
    // --signal against --on-colored is 2.96:1 in dark and 4.18:1 in light, both
    // under the 4.5:1 a 12px badge needs. --signal-strong is 7.11 / 5.96.
    expect(podium).toEqual([
      'var(--accent)',
      'var(--signal-strong)',
      'var(--support)',
    ])
    expect(new Set(podium).size).toBe(3)
  })

  it('drops to a muted surface past third place', () => {
    expect(adminOrderRankStyle(4)).toEqual({
      background: 'var(--surface-muted)',
      color: 'var(--text-tertiary)',
    })
    expect(adminOrderRankStyle(99).background).toBe('var(--surface-muted)')
  })

  it('never emits a raw colour literal', () => {
    for (const rank of [1, 2, 3, 4]) {
      const style = adminOrderRankStyle(rank)
      expect(style.background).toMatch(/^var\(--/)
      expect(style.color).toMatch(/^var\(--/)
    }
  })
})
