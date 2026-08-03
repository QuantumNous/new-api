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
*/
import type { TFunction } from 'i18next'
import { z } from 'zod'

import {
  DISTRIBUTOR_COMMISSION_RATE_MAX,
  DISTRIBUTOR_COMMISSION_RATE_MIN,
  DISTRIBUTOR_NAME_MAX_LENGTH,
  DISTRIBUTOR_STATUS,
  DISTRIBUTOR_TIER,
} from '../constants'
import type {
  Distributor,
  DistributorFormData,
  DistributorPrice,
  DistributorPriceFormData,
  DistributorUpdateData,
} from '../types'

// ============================================================================
// Distributor Form Schema
// ============================================================================

export function getDistributorFormSchema(t: TFunction) {
  return z.object({
    user_id: z.number().min(1, t('User ID is required')),
    name: z
      .string()
      .min(1, t('Name is required'))
      .max(DISTRIBUTOR_NAME_MAX_LENGTH, t('Name is too long')),
    tier: z.string().min(1, t('Tier is required')),
    commission_rate: z
      .number()
      .min(
        DISTRIBUTOR_COMMISSION_RATE_MIN,
        t('Commission rate must be between 0 and 100')
      )
      .max(
        DISTRIBUTOR_COMMISSION_RATE_MAX,
        t('Commission rate must be between 0 and 100')
      ),
    status: z.number(),
  })
}

export type DistributorFormValues = {
  user_id: number
  name: string
  tier: string
  commission_rate: number
  status: number
}

export const DISTRIBUTOR_FORM_DEFAULT_VALUES: DistributorFormValues = {
  user_id: 0,
  name: '',
  tier: DISTRIBUTOR_TIER.STANDARD,
  commission_rate: 0,
  status: DISTRIBUTOR_STATUS.ACTIVE,
}

export function transformFormDataToPayload(
  data: DistributorFormValues
): DistributorFormData {
  return {
    user_id: data.user_id,
    name: data.name.trim(),
    tier: data.tier,
    commission_rate: data.commission_rate,
    status: data.status,
  }
}

export function transformFormDataToUpdatePayload(
  data: DistributorFormValues
): DistributorUpdateData {
  return {
    name: data.name.trim(),
    tier: data.tier,
    commission_rate: data.commission_rate,
    status: data.status,
  }
}

export function transformDistributorToFormDefaults(
  distributor: Distributor
): DistributorFormValues {
  return {
    user_id: distributor.user_id,
    name: distributor.name,
    tier: distributor.tier,
    commission_rate: distributor.commission_rate,
    status: distributor.status,
  }
}

// ============================================================================
// Distributor Price Form Schema
// ============================================================================

export function getDistributorPriceFormSchema(t: TFunction) {
  return z.object({
    model: z.string().min(1, t('Model is required')),
    input_price: z.number().min(0, t('Price must be >= 0')),
    output_price: z.number().min(0, t('Price must be >= 0')),
    currency: z.string().min(1, t('Currency is required')),
    unit: z.string().min(1, t('Unit is required')),
  })
}

export type DistributorPriceFormValues = {
  model: string
  input_price: number
  output_price: number
  currency: string
  unit: string
}

export const DISTRIBUTOR_PRICE_FORM_DEFAULT_VALUES: DistributorPriceFormValues =
  {
    model: '',
    input_price: 0,
    output_price: 0,
    currency: 'CNY',
    unit: 'token',
  }

export function transformPriceFormDataToPayload(
  data: DistributorPriceFormValues
): DistributorPriceFormData {
  return {
    model: data.model.trim(),
    input_price: data.input_price,
    output_price: data.output_price,
    currency: data.currency,
    unit: data.unit,
  }
}

export function transformPriceToFormDefaults(
  price: DistributorPrice
): DistributorPriceFormValues {
  return {
    model: price.model,
    input_price: price.input_price,
    output_price: price.output_price,
    currency: price.currency,
    unit: price.unit,
  }
}
