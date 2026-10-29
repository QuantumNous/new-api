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
import { t } from 'i18next'
import { expect, it } from 'vitest'

import { parseQuotaFromDollars } from '@/lib/format'

import { subscriptionPlanSchema } from '../../types'
import {
  formValuesToPlanPayload,
  getPlanFormSchema,
  PLAN_FORM_DEFAULTS,
  planToFormValues,
} from '../plan-form'

it('round-trips all three period limits through quota-unit API values', () => {
  const values = getPlanFormSchema(t).parse({
    ...PLAN_FORM_DEFAULTS,
    title: 'Pro',
    daily_limit: 10,
    weekly_limit: 50,
    monthly_limit: 100,
  })
  const payload = formValuesToPlanPayload(values)
  expect(payload.plan).toMatchObject({
    daily_limit: parseQuotaFromDollars(10),
    weekly_limit: parseQuotaFromDollars(50),
    monthly_limit: parseQuotaFromDollars(100),
  })
  const plan = subscriptionPlanSchema.parse({ id: 1, ...payload.plan })
  expect(planToFormValues(plan)).toMatchObject({
    daily_limit: 10,
    weekly_limit: 50,
    monthly_limit: 100,
  })
})

it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE])(
  'rejects an invalid period limit of %s',
  (limit) => {
    expect(
      getPlanFormSchema(t).safeParse({
        ...PLAN_FORM_DEFAULTS,
        title: 'Pro',
        daily_limit: limit,
      }).success
    ).toBe(false)
  }
)

it('treats empty period limits as unlimited without changing the original quota reset', () => {
  const values = getPlanFormSchema(t).parse({
    ...PLAN_FORM_DEFAULTS,
    title: 'Pro',
    daily_limit: '',
    weekly_limit: '',
    monthly_limit: '',
    quota_reset_period: 'weekly',
  })
  expect(formValuesToPlanPayload(values).plan).toMatchObject({
    daily_limit: 0,
    weekly_limit: 0,
    monthly_limit: 0,
    quota_reset_period: 'weekly',
  })
})

it('defaults recommendations off and round-trips explicit selection through plan editing', () => {
  expect(PLAN_FORM_DEFAULTS.recommended).toBe(false)
  const values = { ...PLAN_FORM_DEFAULTS, title: 'Selected', recommended: true }
  const payload = formValuesToPlanPayload(getPlanFormSchema(t).parse(values))
  expect(payload.plan.recommended).toBe(true)
  const plan = subscriptionPlanSchema.parse({ id: 1, ...payload.plan })
  expect(planToFormValues(plan).recommended).toBe(true)
})
