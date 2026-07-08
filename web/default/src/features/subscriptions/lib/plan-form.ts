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
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'

import { MAX_SUB_QUOTA_LIMITS } from '../constants'
import type { SubscriptionPlan, PlanPayload } from '../types'

function createSubQuotaLimitSchema(t: TFunction) {
  return z
    .object({
      name: z.string(),
      period_unit: z.enum(['hour', 'day', 'week', 'month']),
      period_value: z.coerce.number().positive(t('Please enter a valid number')),
      limit_usd: z.coerce.number().min(0),
      natural: z.boolean().optional().default(false),
      anchor: z.string().optional().default(''),
    })
    .superRefine((limit, ctx) => {
      if (limit.period_unit === 'week' && limit.period_value < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['period_value'],
          message: t('Please enter a valid number'),
        })
      }
    })
}

export function getPlanFormSchema(t: TFunction) {
  const subQuotaLimitSchema = createSubQuotaLimitSchema(t)

  return z.object({
    title: z.string().min(1, t('Please enter plan title')),
    subtitle: z.string().optional(),
    price_amount: z.coerce.number().min(0, t('Please enter amount')),
    duration_unit: z.enum(['year', 'month', 'day', 'hour', 'custom']),
    duration_value: z.coerce.number().min(1),
    custom_seconds: z.coerce.number().min(0).optional(),
    quota_reset_period: z.enum([
      'never',
      'daily',
      'weekly',
      'monthly',
      'custom',
    ]),
    quota_reset_custom_seconds: z.coerce.number().min(0).optional(),
    enabled: z.boolean(),
    sort_order: z.coerce.number(),
    allow_balance_pay: z.boolean(),
    allow_wallet_overflow: z.boolean(),
    max_purchase_per_user: z.coerce.number().min(0),
    total_amount: z.coerce.number().min(0),
    upgrade_group: z.string().optional(),
    downgrade_group: z.string().optional(),
    stripe_price_id: z.string().optional(),
    creem_product_id: z.string().optional(),
    waffo_pancake_product_id: z.string().optional(),
    sub_quota_limits: z.array(subQuotaLimitSchema).max(MAX_SUB_QUOTA_LIMITS).optional().default([]),
  })
}

export type PlanFormValues = z.infer<ReturnType<typeof getPlanFormSchema>>

export const PLAN_FORM_DEFAULTS: PlanFormValues = {
  title: '',
  subtitle: '',
  price_amount: 0,
  duration_unit: 'month',
  duration_value: 1,
  custom_seconds: 0,
  quota_reset_period: 'never',
  quota_reset_custom_seconds: 0,
  enabled: true,
  sort_order: 0,
  allow_balance_pay: true,
  allow_wallet_overflow: true,
  max_purchase_per_user: 0,
  total_amount: 0,
  upgrade_group: '',
  downgrade_group: '',
  stripe_price_id: '',
  creem_product_id: '',
  waffo_pancake_product_id: '',
  sub_quota_limits: [],
}

function parseSubQuotaLimits(raw: string | undefined): {
  name: string
  period_unit: 'hour' | 'day' | 'week' | 'month'
  period_value: number
  limit_usd: number
  natural: boolean
  anchor: string
}[] {
  if (!raw) return []
  let arr: unknown
  try {
    arr = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []
  return (arr as {
    name?: string
    period_unit?: 'hour' | 'day' | 'week' | 'month'
    period_value?: number
    limit_usd?: number
    natural?: boolean
    anchor?: string
  }[]).map((item) => ({
    name: item?.name || '',
    period_unit: (item?.period_unit || 'hour') as
      | 'hour'
      | 'day'
      | 'week'
      | 'month',
    period_value: Number(item?.period_value || 0),
    limit_usd: Number(item?.limit_usd || 0),
    natural: !!item?.natural,
    anchor:
      item?.anchor ||
      (item?.period_unit === 'hour' ? 'subscription_start' : 'calendar'),
  }))
}

export function planToFormValues(plan: SubscriptionPlan): PlanFormValues {
  return {
    title: plan.title || '',
    subtitle: plan.subtitle || '',
    price_amount: Number(plan.price_amount || 0),
    duration_unit: plan.duration_unit || 'month',
    duration_value: Number(plan.duration_value || 1),
    custom_seconds: Number(plan.custom_seconds || 0),
    quota_reset_period: plan.quota_reset_period || 'never',
    quota_reset_custom_seconds: Number(plan.quota_reset_custom_seconds || 0),
    enabled: plan.enabled !== false,
    sort_order: Number(plan.sort_order || 0),
    allow_balance_pay: plan.allow_balance_pay !== false,
    allow_wallet_overflow: plan.allow_wallet_overflow !== false,
    max_purchase_per_user: Number(plan.max_purchase_per_user || 0),
    total_amount: quotaUnitsToDollars(Number(plan.total_amount || 0)),
    upgrade_group: plan.upgrade_group || '',
    downgrade_group: plan.downgrade_group || '',
    stripe_price_id: plan.stripe_price_id || '',
    creem_product_id: plan.creem_product_id || '',
    waffo_pancake_product_id: plan.waffo_pancake_product_id || '',
    sub_quota_limits: parseSubQuotaLimits(plan.sub_quota_limits),
  }
}

export function formValuesToPlanPayload(values: PlanFormValues): PlanPayload {
  return {
    plan: {
      ...values,
      price_amount: Number(values.price_amount || 0),
      currency: 'USD',
      duration_value: Number(values.duration_value || 0),
      custom_seconds: Number(values.custom_seconds || 0),
      quota_reset_period: values.quota_reset_period || 'never',
      quota_reset_custom_seconds:
        values.quota_reset_period === 'custom'
          ? Number(values.quota_reset_custom_seconds || 0)
          : 0,
      sort_order: Number(values.sort_order || 0),
      max_purchase_per_user: Number(values.max_purchase_per_user || 0),
      total_amount: parseQuotaFromDollars(Number(values.total_amount || 0)),
      upgrade_group: values.upgrade_group || '',
      downgrade_group: values.downgrade_group || '',
      sub_quota_limits: JSON.stringify(values.sub_quota_limits || []),
    },
  }
}
