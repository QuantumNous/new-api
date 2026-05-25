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
import { Shield, User, Users } from 'lucide-react'
import type { User as UserType } from './types'

// ============================================================================
// User Utilities
// ============================================================================

export const isUserDeleted = (user: UserType): boolean => {
  return user.DeletedAt != null
}

// ============================================================================
// User Status Configuration
// ============================================================================

export const USER_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
} as const

export const USER_STATUSES = {
  [USER_STATUS.ENABLED]: {
    labelKey: 'Enabled',
    variant: 'success' as const,
    value: USER_STATUS.ENABLED,
    showDot: true,
  },
  [USER_STATUS.DISABLED]: {
    labelKey: 'Disabled',
    variant: 'neutral' as const,
    value: USER_STATUS.DISABLED,
    showDot: true,
  },
  DELETED: {
    labelKey: 'Deleted',
    variant: 'danger' as const,
    value: -1,
    showDot: false,
  },
} as const

export const getUserStatusOptions = (t: (key: string) => string) => [
  { label: t('Enabled'), value: String(USER_STATUS.ENABLED) },
  { label: t('Disabled'), value: String(USER_STATUS.DISABLED) },
]

// ============================================================================
// User Role Configuration
// ============================================================================

export const USER_ROLE = {
  USER: 1,
  ADMIN: 10,
  ROOT: 100,
} as const

export const USER_ROLES = {
  [USER_ROLE.USER]: {
    labelKey: 'Common User',
    value: USER_ROLE.USER,
    icon: User,
  },
  [USER_ROLE.ADMIN]: {
    labelKey: 'Platform administrator',
    value: USER_ROLE.ADMIN,
    icon: Users,
  },
  [USER_ROLE.ROOT]: {
    labelKey: 'Super administrator',
    value: USER_ROLE.ROOT,
    icon: Shield,
  },
} as const

export const getUserRoleOptions = (t: (key: string) => string) => [
  { label: t('Common User'), value: String(USER_ROLE.USER), icon: User },
  {
    label: t('Platform administrator'),
    value: String(USER_ROLE.ADMIN),
    icon: Users,
  },
  {
    label: t('Super administrator'),
    value: String(USER_ROLE.ROOT),
    icon: Shield,
  },
]

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_GROUP = 'default' as const

// ============================================================================
// Third-party Binding Fields
// ============================================================================

export const BINDING_FIELDS = [
  { key: 'github_id', label: 'GitHub ID' },
  { key: 'discord_id', label: 'Discord ID' },
  { key: 'oidc_id', label: 'OIDC ID' },
  { key: 'wechat_id', label: 'WeChat ID' },
  { key: 'email', label: 'Email' },
  { key: 'telegram_id', label: 'Telegram ID' },
] as const

/** Demo UI: admin user edit surfaces show email binding only. */
export const ADMIN_USER_THIRD_PARTY_BINDINGS_VISIBLE = false

export const ADMIN_VISIBLE_BINDING_FIELDS = [{ key: 'email', label: 'Email' }] as const

// ============================================================================
// Error Messages (i18n keys: use t(ERROR_MESSAGES.xxx) when displaying)
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  NO_USER: 'No account selected',
  LOAD_FAILED: 'Failed to load users',
  SEARCH_FAILED: 'Failed to search users',
  CREATE_FAILED: 'Failed to create user',
  UPDATE_FAILED: 'Failed to update user',
  DELETE_FAILED: 'Failed to delete user',
} as const

// ============================================================================
// Success Messages (i18n keys: use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
} as const

/** i18n key for inline password field validation (FormMessage runs t()). */
export const PASSWORD_LENGTH_MESSAGE_KEY =
  'Password must be between 8 and 20 characters'

export const PASSWORD_VALIDATION_FAILED_KEY =
  'Password does not meet requirements, please check and try again'

export const UPDATE_FORM_INVALID_KEY =
  'Account update failed, please check the form'

/**
 * Client-side password check. Update: empty password is allowed (unchanged).
 * Create: password must be 8–20 characters.
 */
export function getPasswordFieldError(
  password: string | undefined,
  isUpdate: boolean
): string | null {
  const length = password?.length ?? 0
  if (isUpdate && length === 0) {
    return null
  }
  if (length < 8 || length > 20) {
    return PASSWORD_LENGTH_MESSAGE_KEY
  }
  return null
}

export function isBackendPasswordValidationError(message?: string): boolean {
  if (!message) {
    return false
  }
  const lower = message.toLowerCase()
  return (
    lower.includes('user.password') ||
    (lower.includes('password') &&
      (lower.includes('min') ||
        lower.includes('max') ||
        lower.includes('validation')))
  )
}

/**
 * Prefer localized fallback for user-facing toasts; use API message only if it
 * matches a known i18n key (e.g. already translated on the server).
 */
export function resolveUserToastMessage(
  message: string | undefined,
  fallbackKey: string,
  t: (key: string) => string
): string {
  if (message && isBackendPasswordValidationError(message)) {
    console.warn('[users] API password validation:', message)
    return t(PASSWORD_VALIDATION_FAILED_KEY)
  }

  if (message) {
    const translated = t(message)
    if (translated !== message) {
      return translated
    }
    console.warn('[users] API error:', message)
    if (fallbackKey === ERROR_MESSAGES.UPDATE_FAILED) {
      return t(UPDATE_FORM_INVALID_KEY)
    }
  }

  return t(fallbackKey)
}
