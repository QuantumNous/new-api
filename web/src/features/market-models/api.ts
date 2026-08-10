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

import type {
  ApiResponse,
  GetMarketModelsParams,
  GetMarketModelsResponse,
  MarketModel,
  MarketModelFormData,
  PublicMarketModelItem,
} from './types'

// ============================================================================
// Model Market Management (admin)
// ============================================================================

// Get paginated model market items list
export async function getMarketModels(
  params: GetMarketModelsParams = {}
): Promise<GetMarketModelsResponse> {
  const { p = 1, page_size = 20, status = '', category = '' } = params
  const query = new URLSearchParams()
  query.set('p', String(p))
  query.set('page_size', String(page_size))
  if (status) query.set('status', status)
  if (category) query.set('category', category)
  const res = await api.get(`/api/admin/market-models/?${query.toString()}`)
  return res.data
}

// Get single model market item by ID
export async function getMarketModel(
  id: number
): Promise<ApiResponse<MarketModel>> {
  const res = await api.get(`/api/admin/market-models/${id}`)
  return res.data
}

// Create a model market item
export async function createMarketModel(
  data: MarketModelFormData
): Promise<ApiResponse> {
  const res = await api.post('/api/admin/market-models/', data)
  return res.data
}

// Update a model market item
export async function updateMarketModel(
  data: MarketModelFormData & { id: number }
): Promise<ApiResponse> {
  const res = await api.put(`/api/admin/market-models/${data.id}`, data)
  return res.data
}

// Delete a model market item
export async function deleteMarketModel(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/admin/market-models/${id}`)
  return res.data
}

// ============================================================================
// Model Market Storefront (public, no auth)
// ============================================================================

// Get the public, available-only model market catalog. Errors are swallowed so
// anonymous visitors never see error toasts; falls back to an empty list.
export async function getPublicMarketModels(
  locale: string
): Promise<PublicMarketModelItem[]> {
  const res = await api
    .get<ApiResponse<{ items: PublicMarketModelItem[] }>>('/api/market-models', {
      params: { locale },
      skipErrorHandler: true,
    })
    .catch(() => null)
  return res?.data?.data?.items ?? []
}
