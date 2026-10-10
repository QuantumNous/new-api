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
import type { TwoFAStatus } from '@/features/profile/types'
import type { PermissionResourceDef } from '@/lib/admin-permissions'
import { api } from '@/lib/api'
import {
  AuthOperationError,
  authRequestOptions,
  authResult,
} from '@/lib/secure-verification'

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

export interface LegacyAccessToken {
  token_hint: string
  token_ref: string
  created_at: number | null
  last_used_at: number | null
  last_used_ip: string
  /** Unix seconds after which the legacy token stops working. */
  retire_at: number
}

export interface AccessTokenList {
  items: AccessTokenItem[]
  legacy: LegacyAccessToken | null
}

export type AccessTokenGroup = 'personal' | 'admin' | 'system'

export interface AccessTokenCatalog {
  groups: { group: AccessTokenGroup; resources: PermissionResourceDef[] }[]
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

export function listAccessTokens(): Promise<AccessTokenList> {
  return authResult(
    api.get('/api/user/access_tokens', authRequestOptions),
    'Failed to load access tokens'
  )
}

export function getAccessTokenCatalog(): Promise<AccessTokenCatalog> {
  return authResult(
    api.get('/api/user/access_tokens/catalog', authRequestOptions),
    'Failed to load access tokens'
  )
}

// getAccessTokenScopes returns labels for every scope a token can hold, used
// to describe stored grants such as those in audit records.
export function getAccessTokenScopes(): Promise<{
  resources: PermissionResourceDef[]
}> {
  return authResult(
    api.get('/api/user/access_tokens/scopes', authRequestOptions),
    'Failed to load access tokens'
  )
}

export async function createAccessToken(
  input: AccessTokenInput,
  proofToken: string,
  signal: AbortSignal
): Promise<CreatedAccessToken> {
  const created = await authResult<CreatedAccessToken>(
    api.post('/api/user/access_tokens', input, {
      ...authRequestOptions,
      headers: { 'X-Security-Proof': proofToken },
      singleUseAuthorization: true,
      signal,
    }),
    'Failed to generate token'
  )
  if (!created?.token) throw new AuthOperationError('Failed to generate token')
  return created
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
        ...authRequestOptions,
        headers: { 'X-Security-Proof': proof.token },
        singleUseAuthorization: true,
        signal: proof.signal,
      }
    : authRequestOptions
  return authResult(
    api.patch(`/api/user/access_tokens/${id}`, input, options),
    'Failed to save'
  )
}

export async function revokeAccessToken(
  id: number,
  proofToken: string,
  signal: AbortSignal
): Promise<void> {
  await authResult<null>(
    api.delete(`/api/user/access_tokens/${id}`, {
      ...authRequestOptions,
      headers: { 'X-Security-Proof': proofToken },
      singleUseAuthorization: true,
      signal,
    }),
    'Failed to revoke token'
  )
}

export async function revokeLegacyAccessToken(
  proofToken: string,
  signal: AbortSignal
): Promise<void> {
  await authResult<null>(
    api.delete('/api/user/access_tokens/legacy', {
      ...authRequestOptions,
      headers: { 'X-Security-Proof': proofToken },
      singleUseAuthorization: true,
      signal,
    }),
    'Failed to revoke token'
  )
}

export interface TwoFASetupData {
  secret: string
  qr_code_data: string
  backup_codes: string[]
  flow_token: string
  expires_at: number
}

export function get2FAStatus(): Promise<TwoFAStatus> {
  return authResult(api.get('/api/user/2fa/status', authRequestOptions))
}

export function setup2FA(
  proofToken: string,
  signal: AbortSignal
): Promise<TwoFASetupData> {
  return authResult(
    api.post('/api/user/2fa/setup', undefined, {
      ...authRequestOptions,
      signal,
      headers: { 'X-Security-Proof': proofToken },
    })
  )
}

export function enable2FA(
  code: string,
  flowToken: string,
  signal: AbortSignal
): Promise<unknown> {
  return authResult(
    api.post(
      '/api/user/2fa/enable',
      { code, flow_token: flowToken },
      {
        ...authRequestOptions,
        signal,
        acceptAuthRotation: true,
        singleUseAuthorization: true,
      }
    )
  )
}
