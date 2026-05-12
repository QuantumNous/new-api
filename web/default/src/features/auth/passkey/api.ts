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
import type { ApiResponse, PasskeyOptionsPayload, PasskeyStatus } from './types'

export async function getPasskeyStatus(): Promise<ApiResponse<PasskeyStatus>> {
  const res = await api.get<ApiResponse<PasskeyStatus>>('/api/user/passkey')
  return res.data
}

export async function beginPasskeyRegistration(): Promise<
  ApiResponse<PasskeyOptionsPayload>
> {
  const res = await api.post<ApiResponse<PasskeyOptionsPayload>>(
    '/api/user/passkey/register/begin'
  )
  return res.data
}

export async function finishPasskeyRegistration(
  payload: Record<string, unknown>
): Promise<ApiResponse> {
  const res = await api.post<ApiResponse>(
    '/api/user/passkey/register/finish',
    payload
  )
  return res.data
}

export async function deletePasskey(): Promise<ApiResponse> {
  const res = await api.delete<ApiResponse>('/api/user/passkey')
  return res.data
}

export async function beginPasskeyLogin(): Promise<
  ApiResponse<PasskeyOptionsPayload>
> {
  const res = await api.post<ApiResponse<PasskeyOptionsPayload>>(
    '/api/user/passkey/login/begin'
  )
  return res.data
}

export async function finishPasskeyLogin(
  payload: Record<string, unknown>
): Promise<ApiResponse> {
  const res = await api.post<ApiResponse>(
    '/api/user/passkey/login/finish',
    payload
  )
  return res.data
}

export async function beginPasskeyVerification(): Promise<
  ApiResponse<PasskeyOptionsPayload>
> {
  const res = await api.post<ApiResponse<PasskeyOptionsPayload>>(
    '/api/user/passkey/verify/begin'
  )
  return res.data
}

export async function finishPasskeyVerification(
  payload: Record<string, unknown>
): Promise<ApiResponse> {
  const res = await api.post<ApiResponse>(
    '/api/user/passkey/verify/finish',
    payload
  )
  return res.data
}
