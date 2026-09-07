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
const serverErrorMessageKeys = {
  TELEGRAM_OAUTH_NOT_CONFIGURED:
    'Telegram OAuth is not configured or enabled. Please contact your administrator.',
  TELEGRAM_OAUTH_CONFLICT:
    'The telegram OAuth provider name is reserved. Ask your administrator to rename the conflicting custom provider.',
  TELEGRAM_OAUTH_FAILED: 'Telegram authorization failed. Please try again.',
  TELEGRAM_ACCOUNT_NOT_BOUND:
    'This Telegram account is not linked. Sign in using another method and link it first.',
  TELEGRAM_LEGACY_AUTH_REMOVED:
    'Telegram login has changed. Reload the page and start Telegram OAuth again.',
  AUTH_INTERNAL_ERROR: 'Please try again later.',
  SECURITY_VERIFICATION_FAILED: 'Verification failed. Please try again.',
  SECURITY_VERIFICATION_FLOW_REQUIRED:
    'This verification method requires its dedicated verification flow.',
  SECURITY_VERIFICATION_LOCKED:
    'Two-factor authentication is temporarily locked.',
  OAUTH_ACCOUNT_MISMATCH:
    'The OAuth account does not match the account linked to your profile.',
  TWOFA_CODE_INVALID: 'The authenticator code is incorrect.',
  TWOFA_ALREADY_ENABLED: 'Two-factor authentication is already enabled.',
  TWOFA_NOT_ENABLED: 'Two-factor authentication is not enabled.',
  PASSKEY_NOT_FOUND: 'No Passkey is registered.',
  AUTH_FLOW_INVALID: 'Verification flow expired',
  SECURITY_PROOF_REQUIRED: 'Additional verification required',
  SECURITY_PROOF_EXPIRED:
    'Security verification has expired. Please verify again.',
  SECURITY_PROOF_INVALID:
    'Security verification is no longer valid. Please verify again.',
  SECURITY_PROOF_SCOPE_MISMATCH: 'Verification does not match this action.',
  SECURITY_PROOF_CONSUMED:
    'This verification has already been used. Please verify again.',
  SECURITY_PROOF_CONTEXT_MISMATCH:
    "Verification does not match this action's details. Please verify again.",
  SECURITY_CONTEXT_INVALID: 'The action details are invalid.',
  SECURITY_ACTION_FORBIDDEN:
    'You do not have permission to perform this action.',
  SECURITY_PROOF_METHOD_MISMATCH:
    'This verification method is not allowed for this action.',
  SECURITY_METHOD_UNAVAILABLE:
    'This verification method is currently unavailable.',
  TWOFA_SETUP_INVALID:
    'The two-factor setup has expired or changed. Start setup again.',

  AUTH_SESSION_LIMIT:
    'Too many active login sessions. On a device where you are already signed in, open Login sessions and use “Sign out other sessions” to revoke them. If you cannot access a signed-in device, reset your password to sign out all sessions.',
  AUTH_SESSION_ISSUANCE_LIMIT:
    'Too many login sessions were created recently. Please wait for the rolling window to pass, then try again.',
  TELEGRAM_BIND_DISABLED: 'Telegram binding is disabled.',
  TELEGRAM_BIND_INVALID_REQUEST:
    'The Telegram authorization request is invalid or expired.',
  TELEGRAM_BIND_FLOW_INVALID:
    'This Telegram binding request has expired or has already been used.',
  TELEGRAM_BIND_SESSION_INVALID:
    'The login session that started this Telegram binding is no longer valid.',
  TELEGRAM_BIND_ALREADY_BOUND: 'This Telegram account is already bound.',
  TELEGRAM_BIND_USER_DELETED: 'This user account no longer exists.',
  TELEGRAM_BIND_USER_DISABLED: 'This user account is disabled.',
  TELEGRAM_BIND_INTERNAL_ERROR: 'Telegram binding failed. Please try again.',
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function serverErrorPayload(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null

  const response = value.response
  if (isRecord(response) && isRecord(response.data)) {
    return response.data
  }
  return value
}

export function getServerErrorMessageKey(value: unknown): string | null {
  const payload = serverErrorPayload(value)
  if (!payload || typeof payload.code !== 'string') return null

  return (
    serverErrorMessageKeys[
      payload.code as keyof typeof serverErrorMessageKeys
    ] ?? null
  )
}
