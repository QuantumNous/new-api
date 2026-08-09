import { describe, expect, it } from 'vitest'

import {
  ADMIN_ORDER_DEFAULT_RANGE,
  ADMIN_ORDER_METHODS,
  ADMIN_ORDER_RANGES,
  ADMIN_ORDER_SORT_FIELDS,
  ADMIN_ORDER_STATUSES,
  ADMIN_ORDER_TYPES,
  adminOrderMethodLabelKey,
  adminOrderPaymentRailLabelKey,
  adminOrderRankStyle,
  adminOrderStatusLabelKey,
  adminOrderStatusTone,
  adminOrderTypeLabelKey,
  formatAdminOrderAmount,
  isAdminOrderPaymentRail,
  isAdminOrderRange,
} from '@/constants/adminOrders'

describe('admin order contract', () => {
  it('exposes the real top-up lifecycle and read-only providers', () => {
    expect(ADMIN_ORDER_STATUSES).toEqual(['completed', 'pending', 'failed'])
    expect(ADMIN_ORDER_TYPES).toEqual(['topup'])
    expect(ADMIN_ORDER_METHODS).toEqual([
      'epay',
      'stripe',
      'creem',
      'waffo',
      'waffo_pancake',
      'balance',
      'other',
    ])
    expect(ADMIN_ORDER_SORT_FIELDS).toEqual(['id', 'amount', 'created'])
  })

  it('maps every enum member to a translation key', () => {
    ADMIN_ORDER_STATUSES.forEach((status) => {
      expect(adminOrderStatusLabelKey(status)).toBe(`orders.status.${status}`)
    })
    ADMIN_ORDER_TYPES.forEach((type) => {
      expect(adminOrderTypeLabelKey(type)).toBe(`orders.type.${type}`)
    })
    ADMIN_ORDER_METHODS.forEach((method) => {
      expect(adminOrderMethodLabelKey(method)).toBe(`orders.method.${method}`)
    })
    expect(adminOrderPaymentRailLabelKey('alipay')).toBe(
      'orders.paymentRail.alipay'
    )
  })

  it('uses explicit tones for all backend states', () => {
    expect(adminOrderStatusTone('completed')).toBe('success')
    expect(adminOrderStatusTone('pending')).toBe('warning')
    expect(adminOrderStatusTone('failed')).toBe('danger')
  })

  it('recognizes Epay rails and formats CNY separately from USD', () => {
    expect(isAdminOrderPaymentRail('wechat')).toBe(true)
    expect(isAdminOrderPaymentRail('stripe')).toBe(false)
    expect(formatAdminOrderAmount(12.5, 'CNY')).toBe('¥12.50')
    expect(formatAdminOrderAmount(12.5, 'USD')).toBe('$12.50')
  })
})

describe('statistics range', () => {
  it('offers 7, 30 and 90 day windows', () => {
    expect(ADMIN_ORDER_RANGES).toEqual([7, 30, 90])
    expect(ADMIN_ORDER_DEFAULT_RANGE).toBe(30)
    expect(isAdminOrderRange('30')).toBe(true)
    expect(isAdminOrderRange(31)).toBe(false)
  })
})

describe('adminOrderRankStyle', () => {
  it('uses semantic color tokens', () => {
    for (const rank of [1, 2, 3, 4]) {
      const style = adminOrderRankStyle(rank)
      expect(style.background).toMatch(/^var\(--/)
      expect(style.color).toMatch(/^var\(--/)
    }
  })
})
