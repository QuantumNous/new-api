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
  Combo,
  ComboFormData,
  GetCombosParams,
  GetCombosResponse,
} from './types'

// ============================================================================
// Combo Management
// ============================================================================

// Get paginated combo list
export async function getCombos(
  params: GetCombosParams = {}
): Promise<GetCombosResponse> {
  const { page = 1, page_size, keyword } = params
  const res = await api.get('/api/combo/', {
    params: { page, page_size, keyword },
  })
  return res.data.data
}

// Search combos by name keyword (with pagination)
export async function searchCombos(
  keyword: string,
  page: number = 1,
  pageSize?: number
): Promise<GetCombosResponse> {
  const res = await api.get('/api/combo/search', {
    params: { keyword, page, page_size: pageSize },
  })
  return res.data.data
}

// Get single combo by ID
export async function getCombo(id: number): Promise<Combo> {
  const res = await api.get(`/api/combo/${id}`)
  return res.data.data
}

// Create a new combo
export async function createCombo(
  data: ComboFormData
): Promise<Combo> {
  const res = await api.post('/api/combo/', data)
  return res.data.data
}

// Update an existing combo
export async function updateCombo(
  id: number,
  data: ComboFormData
): Promise<Combo> {
  const res = await api.put(`/api/combo/${id}`, data)
  return res.data.data
}

// Delete a single combo
export async function deleteCombo(id: number): Promise<void> {
  await api.delete(`/api/combo/${id}`)
}

// Batch delete multiple combos
export async function batchDeleteCombos(
  ids: number[]
): Promise<{ success: boolean; deleted_count: number }> {
  const res = await api({
    url: '/api/combo/',
    method: 'delete',
    data: { ids },
  })
  return res.data.data
}

// Update combo status (enable/disable)
export async function updateComboStatus(
  id: number,
  status: number
): Promise<Combo> {
  const res = await api.put(`/api/combo/${id}`, { status })
  return res.data.data
}
