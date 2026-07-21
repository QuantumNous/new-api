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
  CreateInvitationCodesRequest,
  InvitationCode,
  InvitationCodeListParams,
  InvitationCodePage,
  InvitationCodeStatus,
} from './types'

export async function getInvitationCodes(
  params: InvitationCodeListParams
): Promise<ApiResponse<InvitationCodePage>> {
  const useSearch = Boolean(params.keyword?.trim() || params.status)
  const endpoint = useSearch ? '/api/invitation/search' : '/api/invitation/'
  const res = await api.get<ApiResponse<InvitationCodePage>>(endpoint, {
    params: {
      keyword: params.keyword?.trim() || undefined,
      status: params.status || undefined,
      p: params.p ?? 1,
      page_size: params.page_size ?? 20,
    },
  })
  return res.data
}

export async function createInvitationCodes(
  request: CreateInvitationCodesRequest
): Promise<ApiResponse<string[]>> {
  const res = await api.post<ApiResponse<string[]>>('/api/invitation/', request)
  return res.data
}

export async function updateInvitationCodeStatus(
  id: number,
  status: Exclude<InvitationCodeStatus, 3>
): Promise<ApiResponse<InvitationCode>> {
  const res = await api.put<ApiResponse<InvitationCode>>(
    '/api/invitation/',
    { id, status },
    { params: { status_only: true } }
  )
  return res.data
}

export async function deleteInvitationCode(id: number): Promise<ApiResponse> {
  const res = await api.delete<ApiResponse>(`/api/invitation/${id}`)
  return res.data
}

export async function deleteUsedInvitationCodes(): Promise<
  ApiResponse<number>
> {
  const res = await api.delete<ApiResponse<number>>('/api/invitation/used')
  return res.data
}
