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
import { api } from '@/lib/api'

import type { PricingData } from './types'

// ----------------------------------------------------------------------------
// Pricing APIs
// ----------------------------------------------------------------------------

// Get model pricing data
export async function getPricing(): Promise<PricingData> {
  const res = await api.get('/api/pricing')
  return res.data
}

// ----------------------------------------------------------------------------
// Model cache stats
// ----------------------------------------------------------------------------

/** Model-level usage sums over the requested window, from quota_data. */
export interface ModelCacheStats {
  model_name: string
  count: number
  prompt_tokens: number
  cache_tokens: number
  cache_creation_tokens: number
  cache_hit_count: number
}

export interface ModelCacheStatsResponse {
  success: boolean
  message: string
  data: ModelCacheStats | null
}

// Get a model's site-wide cache statistics for the model square details.
// The endpoint enforces the cache-rate visibility switches server-side.
export async function getModelCacheStats(
  modelName: string,
  hours = 24
): Promise<ModelCacheStatsResponse> {
  const res = await api.get<ModelCacheStatsResponse>('/api/data/model-cache', {
    params: { model: modelName, hours },
  })
  return res.data
}
