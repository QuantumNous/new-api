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
import { api } from '@/lib/api'

import type {
  ApiResponse,
  Distributor,
  DistributorBilling,
  DistributorFormData,
  DistributorPrice,
  DistributorPriceFormData,
  DistributorSubUser,
  DistributorUpdateData,
  ListDistributorsParams,
} from './types'

// ============================================================================
// Distributor Management
// ============================================================================

export async function listDistributors(
  params: ListDistributorsParams = {}
): Promise<ApiResponse<{ items: Distributor[]; total: number }>> {
  const queryParams = new URLSearchParams()
  queryParams.set('page', String(params.page ?? 1))
  queryParams.set('page_size', String(params.page_size ?? 10))
  if (params.keyword) queryParams.set('keyword', params.keyword)
  const res = await api.get(`/api/admin/distributors?${queryParams.toString()}`)
  return res.data
}

export async function getDistributor(
  id: number
): Promise<ApiResponse<Distributor>> {
  const res = await api.get(`/api/admin/distributors/${id}`)
  return res.data
}

export async function createDistributor(
  data: DistributorFormData
): Promise<ApiResponse<{ id: number }>> {
  const res = await api.post('/api/admin/distributors', data)
  return res.data
}

// Update distributor (full replace; user_id is immutable)
export async function updateDistributor(
  id: number,
  data: DistributorUpdateData
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.put(`/api/admin/distributors/${id}`, data)
  return res.data
}

export async function deleteDistributor(
  id: number
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.delete(`/api/admin/distributors/${id}`)
  return res.data
}

// ============================================================================
// Distributor Sub-Users (read-only)
// ============================================================================

export async function listDistributorSubUsers(
  id: number,
  params: { page?: number; page_size?: number } = {}
): Promise<ApiResponse<{ items: DistributorSubUser[]; total: number }>> {
  const queryParams = new URLSearchParams()
  queryParams.set('page', String(params.page ?? 1))
  queryParams.set('page_size', String(params.page_size ?? 10))
  const res = await api.get(
    `/api/admin/distributors/${id}/sub-users?${queryParams.toString()}`
  )
  return res.data
}

// ============================================================================
// Distributor Billing (read-only)
// ============================================================================

export async function getDistributorBilling(
  id: number
): Promise<ApiResponse<DistributorBilling>> {
  const res = await api.get(`/api/admin/distributors/${id}/billing`)
  return res.data
}

// ============================================================================
// Distributor Price Overrides
// ============================================================================

// Returns all price overrides for a distributor (no pagination server-side)
export async function listDistributorPrices(
  id: number
): Promise<ApiResponse<{ items: DistributorPrice[] }>> {
  const res = await api.get(`/api/admin/distributors/${id}/prices`)
  return res.data
}

export async function createDistributorPrice(
  id: number,
  data: DistributorPriceFormData
): Promise<ApiResponse<{ id: number }>> {
  const res = await api.post(`/api/admin/distributors/${id}/prices`, data)
  return res.data
}

export async function updateDistributorPrice(
  id: number,
  priceId: number,
  data: DistributorPriceFormData
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.put(
    `/api/admin/distributors/${id}/prices/${priceId}`,
    data
  )
  return res.data
}

export async function deleteDistributorPrice(
  id: number,
  priceId: number
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.delete(`/api/admin/distributors/${id}/prices/${priceId}`)
  return res.data
}
