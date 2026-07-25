/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'bun:test'
import type { TFunction } from 'i18next'
import type { SubscriptionPlan } from '../types'
import {
  formValuesToPlanPayload,
  getPlanFormSchema,
  planToFormValues,
  PLAN_FORM_DEFAULTS,
} from './plan-form'

const t = ((key: string) => key) as TFunction

describe('subscription plan local price form fields', () => {
  test('serializes blank Pix and UPI local prices as null', () => {
    const payload = formValuesToPlanPayload({
      ...PLAN_FORM_DEFAULTS,
      title: 'Local price plan',
      pix_price_brl: '',
      upi_price_inr: '',
    })

    expect(payload.plan.pix_price_brl).toBeNull()
    expect(payload.plan.upi_price_inr).toBeNull()
  })

  test('serializes entered Pix and UPI local prices as numbers', () => {
    const payload = formValuesToPlanPayload({
      ...PLAN_FORM_DEFAULTS,
      title: 'Local price plan',
      pix_price_brl: '49.90',
      upi_price_inr: '799.50',
    })

    expect(payload.plan.pix_price_brl).toBe(49.9)
    expect(payload.plan.upi_price_inr).toBe(799.5)
  })

  test('hydrates null local prices back to blank inputs', () => {
    const formValues = planToFormValues({
      id: 1,
      title: 'Local price plan',
      subtitle: '',
      price_amount: 9.99,
      currency: 'USD',
      duration_unit: 'month',
      duration_value: 1,
      enabled: true,
      sort_order: 0,
      max_purchase_per_user: 0,
      total_amount: 0,
      pix_price_brl: null,
      upi_price_inr: 799.5,
    } as SubscriptionPlan)

    expect(formValues.pix_price_brl).toBe('')
    expect(formValues.upi_price_inr).toBe('799.5')
  })

  test('requires entered local prices to be positive and bounded', () => {
    const schema = getPlanFormSchema(t)

    expect(
      schema.safeParse({
        ...PLAN_FORM_DEFAULTS,
        title: 'Local price plan',
        pix_price_brl: '0',
      }).success
    ).toBe(false)
    expect(
      schema.safeParse({
        ...PLAN_FORM_DEFAULTS,
        title: 'Local price plan',
        upi_price_inr: '10000',
      }).success
    ).toBe(false)
    expect(
      schema.safeParse({
        ...PLAN_FORM_DEFAULTS,
        title: 'Local price plan',
        pix_price_brl: '',
        upi_price_inr: '',
      }).success
    ).toBe(true)
  })
})
