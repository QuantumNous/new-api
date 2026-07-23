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
  RegistrationCode,
  ApiResponse,
  GetRegistrationCodesParams,
  GetRegistrationCodesResponse,
  SearchRegistrationCodesParams,
  RegistrationCodeFormData,
} from './types'

// ============================================================================
// Registration Code Management
// ============================================================================

// Get paginated registration codes list
export async function getRegistrationCodes(
  params: GetRegistrationCodesParams = {}
): Promise<GetRegistrationCodesResponse> {
  const { p = 1, page_size = 10 } = params
  const res = await api.get(
    `/api/registration_code?p=${p}&page_size=${page_size}`
  )
  return res.data
}

// Search registration codes by keyword
export async function searchRegistrationCodes(
  params: SearchRegistrationCodesParams
): Promise<GetRegistrationCodesResponse> {
  const { keyword = '', status = '', p = 1, page_size = 10 } = params
  const queryParams = new URLSearchParams()
  queryParams.set('keyword', keyword)
  if (status) queryParams.set('status', status)
  queryParams.set('p', String(p))
  queryParams.set('page_size', String(page_size))
  const res = await api.get(
    `/api/registration_code/search?${queryParams.toString()}`
  )
  return res.data
}

// Get single registration code by ID
export async function getRegistrationCode(
  id: number
): Promise<ApiResponse<RegistrationCode>> {
  const res = await api.get(`/api/registration_code/${id}`)
  return res.data
}

// Create registration code(s)
export async function createRegistrationCode(
  data: RegistrationCodeFormData
): Promise<ApiResponse<string[]>> {
  const res = await api.post('/api/registration_code/', data)
  return res.data
}

// Update registration code
export async function updateRegistrationCode(
  data: RegistrationCodeFormData & { id: number }
): Promise<ApiResponse<RegistrationCode>> {
  const res = await api.put('/api/registration_code/', data)
  return res.data
}

// Delete a single registration code
export async function deleteRegistrationCode(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/registration_code/${id}`)
  return res.data
}

// Delete invalid registration codes (used, expired)
export async function deleteInvalidRegistrationCodes(): Promise<
  ApiResponse<number>
> {
  const res = await api.delete('/api/registration_code/invalid')
  return res.data
}
