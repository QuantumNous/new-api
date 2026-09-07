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

import { combineBillingExpr } from '@/features/pricing/lib/billing-expr'
import type { ModelRatioData } from '@/features/system-settings/models/model-pricing-core'
import {
  buildModelSnapshots,
  type ModelPricingSnapshot,
} from '@/features/system-settings/models/model-pricing-snapshots'

export const PRICING_KEYS = [
  'ModelPrice',
  'ModelRatio',
  'CompletionRatio',
  'CacheRatio',
  'CreateCacheRatio',
  'ImageRatio',
  'AudioRatio',
  'AudioCompletionRatio',
  'billing_setting.billing_mode',
  'billing_setting.billing_expr',
] as const
export type PricingKey = (typeof PRICING_KEYS)[number]
export type PricingValues = Partial<Record<PricingKey, number | string>>
export type PricingOptions = Record<PricingKey, string>

export const pricingFieldMap = {
  price: 'ModelPrice',
  ratio: 'ModelRatio',
  completionRatio: 'CompletionRatio',
  cacheRatio: 'CacheRatio',
  createCacheRatio: 'CreateCacheRatio',
  imageRatio: 'ImageRatio',
  audioRatio: 'AudioRatio',
  audioCompletionRatio: 'AudioCompletionRatio',
} as const

export function pricingOptions(
  values: Record<string, string | boolean>
): PricingOptions {
  return Object.fromEntries(
    PRICING_KEYS.map((key) => {
      let value = values[key]
      if (key === 'billing_setting.billing_mode') value ??= values.BillingMode
      if (key === 'billing_setting.billing_expr') value ??= values.BillingExpr
      return [key, typeof value === 'string' ? value : '{}']
    })
  ) as PricingOptions
}

export function pricingRows(options: PricingOptions): ModelPricingSnapshot[] {
  return buildModelSnapshots({
    modelPrice: options.ModelPrice,
    modelRatio: options.ModelRatio,
    completionRatio: options.CompletionRatio,
    cacheRatio: options.CacheRatio,
    createCacheRatio: options.CreateCacheRatio,
    imageRatio: options.ImageRatio,
    audioRatio: options.AudioRatio,
    audioCompletionRatio: options.AudioCompletionRatio,
    billingMode: options['billing_setting.billing_mode'],
    billingExpr: options['billing_setting.billing_expr'],
  })
}

export function pricingRow(
  name: string,
  values: PricingValues
): ModelRatioData {
  const options = Object.fromEntries(
    PRICING_KEYS.map((key) => [
      key,
      JSON.stringify(values[key] === undefined ? {} : { [name]: values[key] }),
    ])
  ) as PricingOptions
  const row = pricingRows(options)[0]
  let billingMode: ModelRatioData['billingMode'] = 'per-token'
  if (row?.billingMode === 'tiered_expr') billingMode = 'tiered_expr'
  else if (row?.price) billingMode = 'per-request'
  return { ...row, name, billingMode }
}

export function pricingFromDraft(data: ModelRatioData): PricingValues {
  const values: PricingValues = {
    'billing_setting.billing_mode':
      data.billingMode === 'tiered_expr' ? 'tiered_expr' : 'ratio',
  }
  for (const [field, key] of Object.entries(pricingFieldMap)) {
    const value = data[field as keyof typeof pricingFieldMap]
    if (value === undefined || value === '') continue
    const number = Number(value)
    if (!Number.isFinite(number) || number < 0) {
      throw new Error(t('Enter a finite, non-negative price'))
    }
    if (
      data.billingMode === 'tiered_expr' ||
      (data.billingMode === 'per-request'
        ? key === 'ModelPrice'
        : key !== 'ModelPrice')
    ) {
      values[key] = number
    }
  }
  if (data.billingMode === 'tiered_expr') {
    values['billing_setting.billing_expr'] = combineBillingExpr(
      data.billingExpr || '',
      data.requestRuleExpr || ''
    )
  }
  return values
}

export function applyPricingDraft(
  options: PricingOptions,
  data: ModelRatioData,
  names: string[] = [data.name]
): PricingOptions {
  return applyPricingValues(options, pricingFromDraft(data), names)
}

function applyPricingValues(
  options: PricingOptions,
  values: PricingValues,
  names: string[]
): PricingOptions {
  return Object.fromEntries(
    PRICING_KEYS.map((key) => {
      const map = JSON.parse(options[key]) as Record<string, number | string>
      for (const name of names) {
        delete map[name]
        if (values[key] !== undefined) {
          Object.defineProperty(map, name, {
            value: values[key],
            enumerable: true,
            writable: true,
            configurable: true,
          })
        }
      }
      return [key, JSON.stringify(map)]
    })
  ) as PricingOptions
}

export function pricingValuesByModel(
  options: PricingOptions
): Map<string, PricingValues> {
  const models = new Map<string, PricingValues>()
  for (const key of PRICING_KEYS) {
    const map: unknown = JSON.parse(options[key])
    if (map === null || typeof map !== 'object' || Array.isArray(map)) {
      throw new Error(t('Pricing must be a JSON object'))
    }
    for (const [name, value] of Object.entries(map)) {
      if (typeof value !== 'number' && typeof value !== 'string') {
        throw new Error(t('Invalid pricing value'))
      }
      const model = models.get(name) ?? {}
      model[key] = value
      models.set(name, model)
    }
  }
  return models
}

export function applyPriceSyncSelections(
  options: PricingOptions,
  selections: Record<string, Record<string, number | string>>
): PricingOptions {
  let result = options
  for (const [name, fields] of Object.entries(selections)) {
    const next: PricingValues = {}
    const expression =
      typeof fields.billing_expr === 'string' &&
      fields.billing_expr.trim() !== ''
    if (expression) {
      next['billing_setting.billing_mode'] = 'tiered_expr'
      next['billing_setting.billing_expr'] = fields.billing_expr
    } else {
      next['billing_setting.billing_mode'] = 'ratio'
      const fixed = fields.model_price !== undefined
      for (const [field, value] of Object.entries(fields)) {
        if (field === 'billing_mode' || field === 'billing_expr') continue
        if (fixed && field !== 'model_price') continue
        const key = field
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join('') as PricingKey
        if (PRICING_KEYS.includes(key)) next[key] = value
      }
    }
    const validated = pricingFromDraft(pricingRow(name, next))
    if (expression) {
      // Sync is a literal import. The editor may normalize request-rule
      // parentheses, which would otherwise produce another upstream diff.
      validated['billing_setting.billing_expr'] = fields.billing_expr
    }
    result = applyPricingValues(result, validated, [name])
  }
  return result
}
