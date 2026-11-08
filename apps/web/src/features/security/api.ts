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
import type { AxiosError, AxiosResponse } from 'axios'

import { api } from '@/lib/api'

// ============================================================================
// Types (mirroring the fork backend's /api/user/access_tokens contract)
// ============================================================================

export interface AccessTokenItem {
  id: number
  name: string
  token_ref: string
  token_hint: string
  scopes: string[]
  /** Unix seconds; 0 means the token never expires. */
  expires_at: number
  last_used_at: number
  last_used_ip: string
  created_at: number
}

/**
 * Hint about the previous unscoped system token. The backend sends an empty
 * object when no legacy token exists; it is normalized to `null` here.
 */
export interface LegacyAccessToken {
  token_hint: string
  created: boolean
}

export interface AccessTokenList {
  items: AccessTokenItem[]
  legacy: LegacyAccessToken | null
}

export type AccessTokenGroup = 'personal' | 'admin' | 'system'

export interface AccessTokenActionDef {
  action: string
  label_key: string
  /** Plain-text description; the backend sends display strings, not keys. */
  description: string
}

export interface AccessTokenResourceDef {
  resource: string
  label_key: string
  group: AccessTokenGroup
  actions: AccessTokenActionDef[]
}

export interface AccessTokenCatalog {
  groups: { group: AccessTokenGroup; resources: AccessTokenResourceDef[] }[]
  max_tokens: number
  default_expiry_days: number
}

export interface AccessTokenInput {
  name: string
  scopes: string[]
  expires_at: number
}

/** A token edit; scopes is present only when the grant changes. */
export interface AccessTokenUpdate {
  name: string
  scopes?: string[]
}

export interface CreatedAccessToken {
  token: string
  item: AccessTokenItem
}

interface AccessTokenResponse<T> {
  success: boolean
  message?: string
  data?: T
}

// ============================================================================
// Response helpers
// ============================================================================

/**
 * Unwraps the standard `{success, message, data}` envelope. Errors are thrown
 * as `Error` carrying the backend message so the verification dialog can toast
 * it; proof-bearing requests set `skipErrorHandler` so the axios interceptor
 * does not toast a second time.
 */
async function unwrap<T>(
  request: Promise<AxiosResponse<AccessTokenResponse<T>>>,
  fallback: string
): Promise<T> {
  let payload: AccessTokenResponse<T> | undefined
  try {
    payload = (await request).data
  } catch (error) {
    const axiosError = error as AxiosError<AccessTokenResponse<unknown>>
    throw new Error(axiosError.response?.data?.message || fallback)
  }
  if (
    !payload?.success ||
    payload.data === undefined ||
    payload.data === null
  ) {
    throw new Error(payload?.message || fallback)
  }
  return payload.data
}

// ============================================================================
// Access token APIs
// ============================================================================

export async function listAccessTokens(): Promise<AccessTokenList> {
  const data = await unwrap(
    api.get<
      AccessTokenResponse<{
        items: AccessTokenItem[]
        legacy: Partial<LegacyAccessToken> | null
      }>
    >('/api/user/access_tokens'),
    'Failed to load access tokens'
  )
  // The backend answers with `{}` instead of null when no legacy token exists.
  const legacy = data.legacy?.token_hint
    ? { token_hint: data.legacy.token_hint, created: !!data.legacy.created }
    : null
  return { items: data.items ?? [], legacy }
}

export function getAccessTokenCatalog(): Promise<AccessTokenCatalog> {
  return unwrap(
    api.get<AccessTokenResponse<AccessTokenCatalog>>(
      '/api/user/access_tokens/catalog'
    ),
    'Failed to load access tokens'
  )
}

export function createAccessToken(
  input: AccessTokenInput,
  proofToken: string,
  signal: AbortSignal
): Promise<CreatedAccessToken> {
  return unwrap(
    api.post<AccessTokenResponse<CreatedAccessToken>>(
      '/api/user/access_tokens',
      input,
      {
        headers: { 'X-Security-Proof': proofToken },
        skipErrorHandler: true,
        signal,
      }
    ),
    'Failed to generate token'
  )
}

// updateAccessToken renames a token and, when scopes are present, replaces its
// grant. Changing the grant needs a security proof bound to the token and the
// new scopes; a rename needs none.
export function updateAccessToken(
  id: number,
  input: AccessTokenUpdate,
  proof?: { token: string; signal: AbortSignal }
): Promise<AccessTokenItem> {
  const options = proof
    ? {
        headers: { 'X-Security-Proof': proof.token },
        skipErrorHandler: true,
        signal: proof.signal,
      }
    : {}
  return unwrap(
    api.patch<AccessTokenResponse<AccessTokenItem>>(
      `/api/user/access_tokens/${id}`,
      input,
      options
    ),
    'Failed to save'
  )
}

export async function revokeAccessToken(
  id: number,
  proofToken: string,
  signal: AbortSignal
): Promise<true> {
  await unwrap(
    api.delete<AccessTokenResponse<null>>(`/api/user/access_tokens/${id}`, {
      headers: { 'X-Security-Proof': proofToken },
      skipErrorHandler: true,
      signal,
    }),
    'Failed to revoke token'
  )
  return true
}

export async function revokeLegacyAccessToken(
  proofToken: string,
  signal: AbortSignal
): Promise<true> {
  await unwrap(
    api.delete<AccessTokenResponse<null>>('/api/user/access_tokens/legacy', {
      headers: { 'X-Security-Proof': proofToken },
      skipErrorHandler: true,
      signal,
    }),
    'Failed to revoke token'
  )
  return true
}
