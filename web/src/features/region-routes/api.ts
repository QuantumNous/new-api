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
  ListRegionRoutesParams,
  ListRegionRoutesResponse,
  RegionRoute,
  RegionRouteFormData,
} from './types'

// ============================================================================
// Region Route Management
// ============================================================================

// Get paginated region routes list (region/model are exact-match filters).
export async function listRegionRoutes(
  params: ListRegionRoutesParams = {}
): Promise<ListRegionRoutesResponse> {
  const queryParams = new URLSearchParams()
  queryParams.set('page', String(params.page ?? 1))
  queryParams.set('page_size', String(params.page_size ?? 1000))
  if (params.region) queryParams.set('region', params.region)
  if (params.model) queryParams.set('model', params.model)
  const res = await api.get(`/api/admin/region-routes?${queryParams.toString()}`)
  return res.data
}

// Get single region route by ID
export async function getRegionRoute(
  id: number
): Promise<ApiResponse<RegionRoute>> {
  const res = await api.get(`/api/admin/region-routes/${id}`)
  return res.data
}

// Create region route
export async function createRegionRoute(
  data: RegionRouteFormData
): Promise<ApiResponse<{ id: number }>> {
  const res = await api.post('/api/admin/region-routes', data)
  return res.data
}

// Update region route (full replace; always send the complete object)
export async function updateRegionRoute(
  id: number,
  data: RegionRouteFormData
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.put(`/api/admin/region-routes/${id}`, data)
  return res.data
}

// Delete a single region route
export async function deleteRegionRoute(
  id: number
): Promise<ApiResponse<{ ok: boolean }>> {
  const res = await api.delete(`/api/admin/region-routes/${id}`)
  return res.data
}
