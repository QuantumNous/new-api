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
