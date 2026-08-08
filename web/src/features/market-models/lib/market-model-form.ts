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

import { ERROR_MESSAGES } from '../constants'
import type { MarketModel, MarketModelFormData } from '../types'

// ============================================================================
// Form Schema (use getMarketModelFormSchema(t) in components for i18n messages)
// ============================================================================

export function getMarketModelFormSchema(t: TFunction) {
  return z.object({
    model: z
      .string()
      .min(1, t(ERROR_MESSAGES.MODEL_REQUIRED))
      .max(255, t(ERROR_MESSAGES.MODEL_TOO_LONG)),
    provider: z.string().max(64, t(ERROR_MESSAGES.PROVIDER_TOO_LONG)),
    category: z
      .string()
      .min(1, t(ERROR_MESSAGES.CATEGORY_REQUIRED))
      .max(32, t(ERROR_MESSAGES.CATEGORY_TOO_LONG)),
    tags: z.string().max(255, t(ERROR_MESSAGES.TAGS_TOO_LONG)),
    input_price: z.number().min(0, t(ERROR_MESSAGES.PRICE_INVALID)),
    output_price: z.number().min(0, t(ERROR_MESSAGES.PRICE_INVALID)),
    currency: z.enum(['CNY', 'USD']),
    unit: z.enum(['token', 'image', 'second', 'char']),
    metadata: z
      .string()
      .refine((v) => {
        if (!v) return true
        try {
          JSON.parse(v)
          return true
        } catch {
          return false
        }
      }, t(ERROR_MESSAGES.METADATA_INVALID)),
    trial_quota: z.number().min(0, t(ERROR_MESSAGES.TRIAL_INVALID)),
    status: z.number().min(1).max(3),
    featured: z.boolean(),
    sort: z.number(),
  })
}

export type MarketModelFormValues = {
  model: string
  provider: string
  category: string
  tags: string
  input_price: number
  output_price: number
  currency: 'CNY' | 'USD'
  unit: 'token' | 'image' | 'second' | 'char'
  metadata: string
  trial_quota: number
  status: number
  featured: boolean
  sort: number
}

// ============================================================================
// Form Defaults
// ============================================================================

export const MARKET_MODEL_FORM_DEFAULT_VALUES: MarketModelFormValues = {
  model: '',
  provider: '',
  category: '',
  tags: '',
  input_price: 0,
  output_price: 0,
  currency: 'CNY',
  unit: 'token',
  metadata: '',
  trial_quota: 0,
  status: 1,
  featured: false,
  sort: 0,
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
export function transformFormDataToPayload(
  data: MarketModelFormValues
): MarketModelFormData {
  return {
    model: data.model,
    provider: data.provider,
    category: data.category,
    tags: data.tags,
    input_price: data.input_price,
    output_price: data.output_price,
    currency: data.currency,
    unit: data.unit,
    metadata: data.metadata,
    trial_quota: data.trial_quota,
    status: data.status,
    featured: data.featured,
    sort: data.sort,
  }
}

/**
 * Transform market model data to form defaults
 */
export function transformMarketModelToFormDefaults(
  m: MarketModel
): MarketModelFormValues {
  return {
    model: m.model,
    provider: m.provider,
    category: m.category,
    tags: m.tags,
    input_price: m.input_price,
    output_price: m.output_price,
    currency: (m.currency as MarketModelFormValues['currency']) || 'CNY',
    unit: (m.unit as MarketModelFormValues['unit']) || 'token',
    metadata: m.metadata,
    trial_quota: m.trial_quota,
    status: m.status,
    featured: m.featured,
    sort: m.sort,
  }
}
