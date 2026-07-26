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

export type DesktopAuthorizationRequest = {
  id: string
  client_id: string
  client_name: string
  redirect_uri: string
  status: string
  expires_at: number
}

type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T }

export async function getDesktopAuthorizationRequest(
  requestId: string
): Promise<DesktopAuthorizationRequest> {
  const response = await api.get<
    DesktopAuthorizationRequest | ApiEnvelope<DesktopAuthorizationRequest>
  >(`/api/desktop/authorization-requests/${encodeURIComponent(requestId)}`, {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  const body = response.data
  if ('data' in body && body.data) return body.data
  return body as DesktopAuthorizationRequest
}

export async function decideDesktopAuthorization(
  requestId: string,
  approve: boolean
): Promise<{ status: string; redirect_uri: string }> {
  const response = await api.post<
    | { status: string; redirect_uri: string }
    | ApiEnvelope<{ status: string; redirect_uri: string }>
  >(
    `/api/desktop/authorization-requests/${encodeURIComponent(requestId)}/decision`,
    { approve },
    { skipBusinessError: true, skipErrorHandler: true }
  )
  const body = response.data
  if ('data' in body && body.data) return body.data
  return body as { status: string; redirect_uri: string }
}
