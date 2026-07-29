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
  return {
    name: record.model_name,
    billingMode: pricing.mode === 'unset' ? 'per-token' : pricing.mode,
    price: value('model_price'),
    ratio: value('model_ratio'),
    completionRatio: value('completion_ratio'),
    cacheRatio: value('cache_ratio'),
    createCacheRatio: value('create_cache_ratio'),
    imageRatio: value('image_ratio'),
    audioRatio: value('audio_ratio'),
    audioCompletionRatio: value('audio_completion_ratio'),
    billingExpr: pricing.billing_expr,
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
  if (data.billingMode === 'tiered_expr' && data.billingExpr) {
    result.billing_expr = data.billingExpr
  }
  if (result.mode === 'per-request') {
    numericFields
      .filter((field) => field !== 'model_price')
      .forEach((field) => delete result[field])
  } else if (result.mode === 'per-token') {
    delete result.model_price
  }
  return result
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
