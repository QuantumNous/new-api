import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { getPlanFormSchema } from '../lib/plan-form'

const translate = ((key: string) => key) as TFunction

const validPlan = {
  title: 'Weekly plan',
  price_amount: 10,
  duration_unit: 'month' as const,
  duration_value: 1,
  quota_reset_period: 'weekly' as const,
  enabled: true,
  sort_order: 0,
  allow_balance_pay: true,
  allow_wallet_overflow: true,
  max_purchase_per_user: 0,
  total_amount: 400,
  window_amount: 100,
}

describe('subscription plan form quota validation', () => {
  const schema = getPlanFormSchema(translate)

  it('rejects a finite reset plan with no window quota', () => {
    expect(schema.safeParse({ ...validPlan, window_amount: 0 }).success).toBe(
      false
    )
  })

  it('rejects a window quota greater than the finite total quota', () => {
    expect(schema.safeParse({ ...validPlan, window_amount: 500 }).success).toBe(
      false
    )
  })

  it('allows an unlimited plan and does not require a window quota', () => {
    expect(
      schema.safeParse({ ...validPlan, total_amount: 0, window_amount: 0 })
        .success
    ).toBe(true)
  })
})
