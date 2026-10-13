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
import type { AuthBundle } from '@/stores/auth-store'

export type VerificationMethod =
  | '2fa'
  | 'passkey'
  | 'password'
  | 'oauth'
  | 'session'
export type SecurityProofScope =
  | 'channel.key.read'
  | 'passkey.register'
  | 'passkey.delete'
  | '2fa.setup'
  | '2fa.disable'
  | '2fa.backup_codes.regenerate'
  | 'access_token.generate'
  | 'access_token.update'
  | 'access_token.revoke'
  | 'account.binding.bind'
  | 'account.binding.unbind'
  | 'account.password.set'
  | 'account.password.change'
  | 'account.delete'
  | 'admin.user.create'
  | 'admin.user.update'
  | 'admin.user.delete'
  | 'admin.user.manage'
  | 'admin.user.passkey.reset'
  | 'admin.user.2fa.disable'
  | 'admin.user.binding.clear'

/** ManageUser actions that change a user's status or role and need step-up. */
export type AdminUserManageAction = 'disable' | 'enable' | 'promote' | 'demote'

export type VerificationOperation =
  | { scope: 'channel.key.read'; context: { channel_id: number } }
  | {
      scope: 'account.binding.bind'
      context: { provider: string; email?: string; code?: string }
    }
  | { scope: 'account.binding.unbind'; context: { provider_id: number } }
  | { scope: 'admin.user.create'; context: { role: number } }
  | {
      scope:
        | 'admin.user.update'
        | 'admin.user.delete'
        | 'admin.user.passkey.reset'
        | 'admin.user.2fa.disable'
      context: { user_id: number }
    }
  | {
      scope: 'admin.user.manage'
      context: { user_id: number; action: AdminUserManageAction }
    }
  | {
      scope: 'admin.user.binding.clear'
      context:
        | { user_id: number; binding_type: string }
        | { user_id: number; provider_id: number }
    }
  | {
      scope: 'access_token.generate'
      context: { scopes: string[]; expires_at: number }
    }
  | {
      scope: 'access_token.update'
      context: { token_id: number; scopes: string[] }
    }
  | {
      scope: 'access_token.revoke'
      context: { token_id: number } | { legacy: true }
    }
  | {
      scope: Exclude<
        SecurityProofScope,
        | 'channel.key.read'
        | 'account.binding.bind'
        | 'account.binding.unbind'
        | 'access_token.generate'
        | 'access_token.update'
        | 'access_token.revoke'
        | `admin.user.${string}`
      >
      context?: Record<string, never>
    }

export interface SecurityProof {
  proof_token: string
  expires_at: number
  method: VerificationMethod
  scope: SecurityProofScope
}

export interface VerificationRequirements {
  scope: SecurityProofScope | 'auth.login'
  methods: { method: VerificationMethod; available: boolean; reason?: string }[]
  oauth_providers: { slug: string; name: string }[]
  password_encryption_enabled: boolean
}

export type VerificationInput =
  | { method: '2fa'; code: string }
  | { method: 'password'; password: string }
  | { method: 'passkey'; rpID?: string }
  | { method: 'oauth'; provider: string }
  | { method: 'session' }

export type RequestVerificationOptions = VerificationOperation & {
  title?: string
  description?: string
}

export interface LoginChallenge {
  require_verification: true
  flow_token: string
  expires_at: number
  methods: VerificationRequirements['methods']
}

export interface RequestLoginVerificationOptions {
  scope: 'auth.login'
  challenge: LoginChallenge
  title?: string
  description?: string
}

export type VerificationRequest =
  | RequestVerificationOptions
  | RequestLoginVerificationOptions
export type LoginResult = AuthBundle | LoginChallenge

export type SecureVerificationState =
  | { phase: 'idle' }
  | { phase: 'loading'; request: VerificationRequest }
  | { phase: 'error'; request: VerificationRequest; error: string }
  | {
      phase: 'ready' | 'verifying'
      request: VerificationRequest
      requirements: VerificationRequirements
      input: VerificationInput | null
      error?: string
    }
