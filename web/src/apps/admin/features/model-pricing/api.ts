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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { t } from 'i18next'

import {
  invalidateModelPricing,
  useCanEditModelPricing,
  type ModelPricingChange,
  type ModelPricingConfig,
  type ModelPricingConversion,
} from '@/shared/features/model-pricing/api'
import { api } from '@/shared/lib/api'
import { createServerError } from '@/shared/lib/server-error-message'

import type {
  CacheWriteMode,
  LegacyBillingDetails,
  PricingValues,
} from '@/shared/features/model-pricing/pricing'

export async function previewModelPricingConversion(request: {
  model_name: string
  pricing: PricingValues
}): Promise<ModelPricingConversion> {
  const response = await api.post('/api/option/model_pricing/convert', request)
  if (!response.data.success) {
    throw createServerError(
      response.data,
      t('Failed to prepare pricing conversion')
    )
  }
  return response.data.data
}

export async function previewModelPricing(request: {
  model_name: string
  pricing: PricingValues
}): Promise<{
  effective: PricingValues
  cacheWriteMode?: CacheWriteMode
  billingDetails?: LegacyBillingDetails
}> {
  const response = await api.post('/api/option/model_pricing/preview', request)
  if (!response.data.success) {
    throw createServerError(response.data, t('Failed to load model pricing'))
  }
  return {
    effective: response.data.data.effective,
    cacheWriteMode: response.data.data.cache_write_mode,
    billingDetails: response.data.data.billing_details,
  }
}

export async function getModelPricing(
  names: string[] = []
): Promise<ModelPricingConfig> {
  const params = new URLSearchParams()
  for (const name of names) params.append('model', name)
  const res = await api.get('/api/option/model_pricing', { params })
  if (!res.data.success) {
    throw createServerError(res.data, t('Failed to load model pricing'))
  }
  return res.data.data
}

export function useModelPricing(names: string[] = [], enabled = true) {
  const canEdit = useCanEditModelPricing()
  return useQuery({
    queryKey: ['model-pricing-config', ...names],
    queryFn: () => getModelPricing(names),
    enabled: enabled && canEdit,
    refetchOnWindowFocus: false,
  })
}

export async function saveModelPricing(changes: ModelPricingChange[]) {
  if (!changes.length) return
  const res = await api.patch('/api/option/model_pricing', { changes })
  if (!res.data.success) {
    throw createServerError(res.data, t('Failed to save model pricing'))
  }
}

export function useSaveModelPricing() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: saveModelPricing,
    onSuccess: () => invalidateModelPricing(client),
  })
}
