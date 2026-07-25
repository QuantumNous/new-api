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
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'
import type { SubscriptionPlan, PlanPayload } from '../types'

const maxLocalPrice = 9999.999999

const localPriceSchema = (t: TFunction) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || Number(value) > 0, {
      message: t('Local price must be greater than zero'),
    })
    .refine((value) => value === '' || Number(value) <= maxLocalPrice, {
      message: t('Local price cannot exceed 9999.999999'),
    })

function localPriceToFormValue(value: number | null | undefined): string {
  return value == null ? '' : String(value)
}

function localPriceToPayload(value: string | null | undefined): number | null {
  const normalized = String(value ?? '').trim()
  return normalized === '' ? null : Number(normalized)
}

export function getPlanFormSchema(t: TFunction) {
  return z.object({
    title: z.string().min(1, t('Please enter plan title')),
    subtitle: z.string().optional(),
    price_amount: z.coerce.number().min(0, t('Please enter amount')),
    pix_price_brl: localPriceSchema(t),
    upi_price_inr: localPriceSchema(t),
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
    max_purchase_per_user: z.coerce.number().min(0),
    total_amount: z.coerce.number().min(0),
    upgrade_group: z.string().optional(),
    stripe_price_id: z.string().optional(),
    creem_product_id: z.string().optional(),
    waffo_pancake_product_id: z.string().optional(),
    model_count: z.coerce.number().min(0).optional(),
    rpm: z.coerce.number().min(0).optional(),
    concurrency: z.coerce.number().min(0).optional(),
    media_credits_monthly: z.coerce.number().min(0).optional(),
    window_5h_amount: z.coerce.number().min(0).optional(),
    window_week_amount: z.coerce.number().min(0).optional(),
    feature_lines: z.string().optional(),
  })
}

export type PlanFormValues = z.infer<ReturnType<typeof getPlanFormSchema>>

export const PLAN_FORM_DEFAULTS: PlanFormValues = {
  title: '',
  subtitle: '',
  price_amount: 0,
  pix_price_brl: '',
  upi_price_inr: '',
  duration_unit: 'month',
  duration_value: 1,
  custom_seconds: 0,
  quota_reset_period: 'never',
  quota_reset_custom_seconds: 0,
  enabled: true,
  sort_order: 0,
  allow_balance_pay: true,
  max_purchase_per_user: 0,
  total_amount: 0,
  upgrade_group: '',
  stripe_price_id: '',
  creem_product_id: '',
  waffo_pancake_product_id: '',
  model_count: 0,
  rpm: 0,
  concurrency: 0,
  media_credits_monthly: 0,
  window_5h_amount: 0,
  window_week_amount: 0,
  feature_lines: '',
}

export function planToFormValues(plan: SubscriptionPlan): PlanFormValues {
  return {
    title: plan.title || '',
    subtitle: plan.subtitle || '',
    price_amount: Number(plan.price_amount || 0),
    pix_price_brl: localPriceToFormValue(plan.pix_price_brl),
    upi_price_inr: localPriceToFormValue(plan.upi_price_inr),
    duration_unit: plan.duration_unit || 'month',
    duration_value: Number(plan.duration_value || 1),
    custom_seconds: Number(plan.custom_seconds || 0),
    quota_reset_period: plan.quota_reset_period || 'never',
    quota_reset_custom_seconds: Number(plan.quota_reset_custom_seconds || 0),
    enabled: plan.enabled !== false,
    sort_order: Number(plan.sort_order || 0),
    allow_balance_pay: plan.allow_balance_pay !== false,
    max_purchase_per_user: Number(plan.max_purchase_per_user || 0),
    total_amount: quotaUnitsToDollars(Number(plan.total_amount || 0)),
    upgrade_group: plan.upgrade_group || '',
    stripe_price_id: plan.stripe_price_id || '',
    creem_product_id: plan.creem_product_id || '',
    waffo_pancake_product_id: plan.waffo_pancake_product_id || '',
    model_count: Number(plan.model_count || 0),
    rpm: 0,
    concurrency: Number(plan.concurrency || 0),
    media_credits_monthly: Number(plan.media_credits_monthly || 0),
    window_5h_amount: quotaUnitsToDollars(Number(plan.window_5h_amount || 0)),
    window_week_amount: quotaUnitsToDollars(
      Number(plan.window_week_amount || 0)
    ),
    feature_lines: plan.feature_lines || '',
  }
}

export function formValuesToPlanPayload(values: PlanFormValues): PlanPayload {
  return {
    plan: {
      ...values,
      price_amount: Number(values.price_amount || 0),
      currency: 'USD',
      pix_price_brl: localPriceToPayload(values.pix_price_brl),
      upi_price_inr: localPriceToPayload(values.upi_price_inr),
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
      model_count: Number(values.model_count || 0),
      rpm: 0,
      concurrency: Number(values.concurrency || 0),
      media_credits_monthly: Number(values.media_credits_monthly || 0),
      window_5h_amount: parseQuotaFromDollars(
        Number(values.window_5h_amount || 0)
      ),
      window_week_amount: parseQuotaFromDollars(
        Number(values.window_week_amount || 0)
      ),
      feature_lines: values.feature_lines || '',
    },
  }
}
