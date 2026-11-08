import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import {
  getPlanFormSchema,
  planToFormValues,
  formValuesToPlanPayload,
} from '../lib/plan-form'

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

  it('lets a legacy periodic plan keep its cycle allowance when edited', () => {
    const values = planToFormValues({
      ...validPlan,
      id: 10,
      currency: 'USD',
      total_amount: 500_000,
      window_amount: 0,
      quota_model_version: 0,
    })
    expect(schema.safeParse(values).success).toBe(true)
    const payload = formValuesToPlanPayload(values)
    expect(payload.plan.window_amount).toBe(500_000)
    expect(payload.plan.quota_model_version).toBe(1)
  })

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
