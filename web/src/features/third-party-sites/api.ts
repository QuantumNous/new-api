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
  ThirdPartySite,
  ThirdPartySitePayload,
  ThirdPartySitesPage,
} from './types'

export async function getThirdPartySites(params: {
  p: number
  page_size: number
}): Promise<ApiResponse<ThirdPartySitesPage>> {
  const res = await api.get(
    `/api/third_party_site/?p=${params.p}&page_size=${params.page_size}`
  )
  return res.data
}

export async function createThirdPartySite(
  payload: ThirdPartySitePayload
): Promise<ApiResponse<ThirdPartySite>> {
  const res = await api.post('/api/third_party_site/', payload)
  return res.data
}

export async function updateThirdPartySite(
  id: number,
  payload: ThirdPartySitePayload
): Promise<ApiResponse<ThirdPartySite>> {
  const res = await api.put(`/api/third_party_site/${id}`, payload)
  return res.data
}

export async function deleteThirdPartySite(
  id: number
): Promise<ApiResponse<null>> {
  const res = await api.delete(`/api/third_party_site/${id}`)
  return res.data
}
