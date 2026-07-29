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
import {
  combineBillingExpr,
  splitBillingExprAndRequestRules,
} from '@/features/pricing/lib/billing-expr'
import type { ModelRatioData } from '@/features/system-settings/models/model-pricing-sheet'

export type ModelPricing = {
  mode: 'per-token' | 'per-request' | 'tiered_expr' | 'unset'
  model_price?: number
  model_ratio?: number
  completion_ratio?: number
  cache_ratio?: number
  create_cache_ratio?: number
  image_ratio?: number
  audio_ratio?: number
  audio_completion_ratio?: number
  billing_expr?: string
}

export type PricingModelRecord = {
  model_name: string
  has_channel: boolean
  configured: boolean
  completion_ratio_locked: boolean
  pricing: ModelPricing
}

export type PricingStatusFilter = 'all' | 'configured' | 'unconfigured'

const numericFields = [
  'model_price',
  'model_ratio',
  'completion_ratio',
  'cache_ratio',
  'create_cache_ratio',
  'image_ratio',
  'audio_ratio',
  'audio_completion_ratio',
] as const

export function pricingRecordToEditor(
  record: PricingModelRecord
): ModelRatioData {
  const pricing = record.pricing
  const value = (field: (typeof numericFields)[number]) =>
    pricing[field] === undefined ? undefined : String(pricing[field])

  let billingMode: ModelRatioData['billingMode'] = 'per-token'
  if (pricing.mode === 'tiered_expr') {
    billingMode = 'tiered_expr'
  } else if (pricing.mode === 'per-request') {
    billingMode = 'per-request'
  } else if (pricing.mode !== 'unset') {
    billingMode = pricing.mode
  } else if (pricing.model_price !== undefined) {
    billingMode = 'per-request'
  }

  const split =
    pricing.mode === 'tiered_expr' && pricing.billing_expr
      ? splitBillingExprAndRequestRules(pricing.billing_expr)
      : { billingExpr: pricing.billing_expr, requestRuleExpr: '' }

  return {
    name: record.model_name,
    billingMode,
    price: value('model_price'),
    ratio: value('model_ratio'),
    completionRatio: value('completion_ratio'),
    cacheRatio: value('cache_ratio'),
    createCacheRatio: value('create_cache_ratio'),
    imageRatio: value('image_ratio'),
    audioRatio: value('audio_ratio'),
    audioCompletionRatio: value('audio_completion_ratio'),
    billingExpr: split.billingExpr,
    requestRuleExpr: split.requestRuleExpr || undefined,
    completionRatioLocked: record.completion_ratio_locked,
  }
}

export function editorToPricing(data: ModelRatioData): ModelPricing {
  const result: ModelPricing = { mode: data.billingMode ?? 'per-token' }
  const assign = (key: (typeof numericFields)[number], value?: string) => {
    if (value !== undefined && value !== '') result[key] = Number(value)
  }
  assign('model_price', data.price)
  assign('model_ratio', data.ratio)
  assign('completion_ratio', data.completionRatio)
  assign('cache_ratio', data.cacheRatio)
  assign('create_cache_ratio', data.createCacheRatio)
  assign('image_ratio', data.imageRatio)
  assign('audio_ratio', data.audioRatio)
  assign('audio_completion_ratio', data.audioCompletionRatio)
  if (data.billingMode === 'tiered_expr') {
    const combined = combineBillingExpr(
      data.billingExpr || '',
      data.requestRuleExpr || ''
    )
    if (combined) result.billing_expr = combined
  }
  if (result.mode === 'per-request') {
    numericFields
      .filter((field) => field !== 'model_price')
      .forEach((field) => delete result[field])
    delete result.billing_expr
  } else if (result.mode === 'per-token') {
    delete result.model_price
    delete result.billing_expr
  }
  return result
}

/** Drop completion_ratio when the vendor locks output ratio. */
export function stripLockedCompletionRatio(
  pricing: ModelPricing,
  locked: boolean
): ModelPricing {
  if (!locked) return pricing
  const next = { ...pricing }
  delete next.completion_ratio
  return next
}

export function filterPricingModels(
  models: PricingModelRecord[],
  options: { search?: string; status?: PricingStatusFilter }
): PricingModelRecord[] {
  const search = (options.search ?? '').trim().toLowerCase()
  const status = options.status ?? 'all'
  return models.filter((model) => {
    if (status === 'configured' && !model.configured) return false
    if (status === 'unconfigured' && model.configured) return false
    if (!search) return true
    return model.model_name.toLowerCase().includes(search)
  })
}

/**
 * Keep the current selection when it still appears in the filtered list;
 * otherwise fall back to the preferred name, then the first visible model.
 */
export function resolveSelectedModelName(
  filtered: PricingModelRecord[],
  currentSelected?: string | null,
  preferred?: string | null
): string | null {
  if (filtered.length === 0) return null
  if (
    currentSelected &&
    filtered.some((model) => model.model_name === currentSelected)
  ) {
    return currentSelected
  }
  if (preferred && filtered.some((model) => model.model_name === preferred)) {
    return preferred
  }
  return filtered[0]?.model_name ?? null
}

export function mergeReferenceResolution(
  current: ModelPricing,
  selected: Record<string, number | string>
): ModelPricing | null {
  const next = { ...current }
  const hasPrice = selected.model_price !== undefined
  const hasModelRatio = selected.model_ratio !== undefined
  const hasExtraRatio = numericFields
    .slice(2)
    .some((field) => selected[field] !== undefined)
  const selectsTiered =
    selected.billing_mode === 'tiered_expr' ||
    selected.billing_expr !== undefined
  const selectsRatioMode =
    selected.billing_mode === 'ratio' || selected.billing_mode === 'per-token'
  if (hasPrice) {
    next.mode = 'per-request'
    numericFields.slice(1).forEach((field) => delete next[field])
    delete next.billing_expr
  } else if (hasModelRatio || selectsRatioMode) {
    if (selected.model_ratio === undefined && next.model_ratio === undefined) {
      return null
    }
    next.mode = 'per-token'
    delete next.model_price
    delete next.billing_expr
  } else if (hasExtraRatio && next.mode !== 'per-token' && !selectsTiered) {
    return null
  }
  for (const [key, value] of Object.entries(selected)) {
    if (key === 'billing_mode') {
      next.mode =
        value === 'ratio' ? 'per-token' : (value as ModelPricing['mode'])
    } else if (key === 'billing_expr') {
      next.mode = 'tiered_expr'
      next.billing_expr = String(value)
    } else (next as Record<string, unknown>)[key] = Number(value)
  }
  if (next.mode === 'per-token' && next.model_ratio === undefined) return null
  if (next.mode === 'per-request' && next.model_price === undefined) return null
  if (
    next.mode === 'tiered_expr' &&
    (next.billing_expr === undefined || next.billing_expr.trim() === '')
  ) {
    return null
  }
  return next
}

export function recordsToLegacyMaps(records: PricingModelRecord[]) {
  const maps: Record<string, Record<string, number | string>> = {
    ModelPrice: {},
    ModelRatio: {},
    CompletionRatio: {},
    CacheRatio: {},
    CreateCacheRatio: {},
    ImageRatio: {},
    AudioRatio: {},
    AudioCompletionRatio: {},
    'billing_setting.billing_mode': {},
    'billing_setting.billing_expr': {},
  }
  const keyMap: Record<string, string> = {
    model_price: 'ModelPrice',
    model_ratio: 'ModelRatio',
    completion_ratio: 'CompletionRatio',
    cache_ratio: 'CacheRatio',
    create_cache_ratio: 'CreateCacheRatio',
    image_ratio: 'ImageRatio',
    audio_ratio: 'AudioRatio',
    audio_completion_ratio: 'AudioCompletionRatio',
  }
  for (const record of records) {
    for (const field of numericFields) {
      const value = record.pricing[field]
      if (value !== undefined) maps[keyMap[field]][record.model_name] = value
    }
    if (record.pricing.mode === 'tiered_expr') {
      maps['billing_setting.billing_mode'][record.model_name] = 'tiered_expr'
    }
    if (record.pricing.billing_expr !== undefined) {
      maps['billing_setting.billing_expr'][record.model_name] =
        record.pricing.billing_expr
    }
  }
  return Object.fromEntries(
    Object.entries(maps).map(([key, value]) => [key, JSON.stringify(value)])
  )
}
