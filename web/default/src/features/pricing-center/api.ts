/* Copyright (C) 2023-2026 QuantumNous */
import { api } from '@/lib/api'

import type { ModelPricing, PricingModelRecord } from './model-pricing-domain'

export const pricingCenterQueryKey = ['admin', 'pricing', 'models'] as const
export type PricingModelsData = {
  revision: number
  summary: { total: number; configured: number; unconfigured: number }
  models: PricingModelRecord[]
}
export async function getPricingModels() {
  return (
    await api.get<{ data: PricingModelsData }>('/api/admin/pricing/models')
  ).data.data
}
export async function putPricingModel(
  revision: number,
  model_name: string,
  pricing: ModelPricing
) {
  return (
    await api.put<{ data: { revision: number } }>(
      '/api/admin/pricing/models',
      {
        revision,
        model: { model_name, pricing },
      },
      {
        skipErrorHandler: true,
      }
    )
  ).data.data
}
export async function bulkPutPricingModels(
  revision: number,
  models: Array<{ model_name: string; pricing: ModelPricing }>
) {
  return (
    await api.post<{ data: { revision: number } }>(
      '/api/admin/pricing/models/bulk',
      { revision, models },
      { skipErrorHandler: true }
    )
  ).data.data
}
