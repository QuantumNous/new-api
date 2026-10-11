import { describe, expect, test } from 'vitest'

import {
  PLAN_FORM_DEFAULTS,
  formValuesToPlanPayload,
  planToFormValues,
} from '../plan-form'

describe('subscription price currency', () => {
  test.each(['CNY', 'USD'] as const)(
    'saves and restores a %s price without currency conversion',
    (currency) => {
      const values = {
        ...PLAN_FORM_DEFAULTS,
        title: 'Monthly',
        price_amount: 10,
        currency,
      }
      const payload = formValuesToPlanPayload(values)
      expect(payload.plan.currency).toBe(currency)
      expect(payload.plan.price_amount).toBe(10)
      const restored = planToFormValues({ ...values, id: 1 })
      expect(restored.currency).toBe(currency)
      expect(restored.price_amount).toBe(10)
    }
  )
})
