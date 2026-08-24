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

import type { SubscriptionPlan, PlanPayload } from '../types'

export function getPlanFormSchema(t: TFunction) {
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
    // Agent plan extensions
    tag: z.string().optional(),
    plan_level: z.string().optional(),
    five_hour_limit: z.coerce.number().min(0).optional(),
    weekly_limit: z.coerce.number().min(0).optional(),
    monthly_limit: z.coerce.number().min(0).optional(),
    allowed_models: z.string().optional(),
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
  tag: '',
  plan_level: '',
  five_hour_limit: 0,
  weekly_limit: 0,
  monthly_limit: 0,
  allowed_models: '',
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
    tag: plan.tag || '',
    plan_level: plan.plan_level || '',
    five_hour_limit: Number(plan.five_hour_limit || 0),
    weekly_limit: Number(plan.weekly_limit || 0),
    monthly_limit: Number(plan.monthly_limit || 0),
    allowed_models: allowedModelsJsonToText(plan.allowed_models || ''),
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
      tag: values.tag || '',
      plan_level: values.plan_level || '',
      five_hour_limit: Number(values.five_hour_limit || 0),
      weekly_limit: Number(values.weekly_limit || 0),
      monthly_limit: Number(values.monthly_limit || 0),
      allowed_models: parseAllowedModelsText(values.allowed_models || ''),
    },
  }
}

// ----------------------------------------------------------------------------
// Allowed models helpers
// ----------------------------------------------------------------------------
// The backend stores AllowedModels as a JSON-encoded array of
// {model, ratio}. The admin drawer edits it as one entry per line in the form
// "<model> <ratio>" (ratio optional, defaults to 1). Round-tripping through
// the textarea keeps the form state human-readable without a custom cell editor.

export interface AllowedModelRow {
  model: string
  ratio: number
}

export function parseAllowedModelsText(raw: string): string {
  const rows = parseAllowedModelsRows(raw)
  if (rows.length === 0) return ''
  return JSON.stringify(rows)
}

export function allowedModelsJsonToText(json: string): string {
  if (!json) return ''
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return ''
  }
  if (!Array.isArray(parsed)) return ''
  const rows = (parsed as AllowedModelRow[])
    .map((r) => {
      const m = typeof r?.model === 'string' ? r.model.trim() : ''
      const ratio = Number(r?.ratio ?? 1)
      if (!m) return ''
      return `${m} ${Number.isFinite(ratio) ? ratio : 1}`
    })
    .filter(Boolean)
  return rows.join('\n')
}

export function parseAllowedModelsRows(raw: string): AllowedModelRow[] {
  if (!raw) return []
  const out: AllowedModelRow[] = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const tokens = trimmed.split(/\s+/)
    const model = tokens[0]
    const ratio = Number(tokens[1] ?? 1)
    if (!model) continue
    if (!Number.isFinite(ratio) || ratio <= 0) continue
    out.push({ model, ratio })
  }
  return out
}
