import { describe, expect, it } from 'vitest'

import {
  parseBackendPlan,
  parseBackendSubscription,
  toEntitlement,
  toPlan,
} from '@/composables/useSubscription'

const basePlan = {
  id: 3,
  title: 'Annual Pro',
  subtitle: 'Shared quota',
  price_amount: 99,
  currency: 'USD',
  duration_unit: 'year',
  duration_value: 1,
  custom_seconds: 0,
  total_amount: 2_000_000,
  quota_reset_period: 'monthly',
  quota_reset_custom_seconds: 0,
  allow_balance_pay: true,
}

const baseSubscription = {
  id: 8,
  plan_id: 3,
  amount_total: 1_500_000,
  amount_used: 250_000,
  start_time: 1_700_000_000,
  end_time: 1_731_536_000,
  last_reset_time: 1_700_000_000,
  next_reset_time: 1_702_678_400,
  status: 'active',
}

function expectInvalidResponse(parse: () => unknown): void {
  try {
    parse()
    throw new Error('expected INVALID_RESPONSE')
  } catch (error) {
    expect(error).toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    })
  }
}

describe('subscription contracts', () => {
  it('keeps plan duration and quota reset periods distinct', () => {
    const annual = toPlan(parseBackendPlan(basePlan))
    expect(annual.term).toEqual({ value: 1, unit: 'year' })
    expect(annual.period).toEqual({ value: 1, unit: 'month' })

    const custom = toPlan(
      parseBackendPlan({
        ...basePlan,
        duration_unit: 'custom',
        custom_seconds: 7_200,
        quota_reset_period: 'custom',
        quota_reset_custom_seconds: 900,
      })
    )
    expect(custom.term).toEqual({ value: 7_200, unit: 'custom' })
    expect(custom.period).toEqual({ value: 900, unit: 'custom' })

    const neverReset = toPlan(
      parseBackendPlan({ ...basePlan, quota_reset_period: 'never' })
    )
    expect(neverReset.period).toEqual(neverReset.term)
  })

  it('uses the subscription instance quota snapshot and a stable fallback name', () => {
    const subscription = parseBackendSubscription(baseSubscription)
    const entitlement = toEntitlement(subscription, undefined)

    expect(entitlement).toMatchObject({
      name: '订阅 #3',
      period_quota: 1_500_000,
      period_used: 250_000,
      auto_renew: false,
    })
  })

  it('rejects plans and subscriptions with missing required fields', () => {
    expectInvalidResponse(() => parseBackendPlan({ id: 3 }))
    expectInvalidResponse(() =>
      parseBackendSubscription({ ...baseSubscription, amount_total: undefined })
    )
  })
})
