import { Shield, User, Users } from 'lucide-react'

// ============================================================================
// User Status Configuration
// ============================================================================

export const USER_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
} as const

export const USER_STATUSES = {
  [USER_STATUS.ENABLED]: {
    label: 'Enabled',
    variant: 'success' as const,
    value: USER_STATUS.ENABLED,
    showDot: true,
  },
  [USER_STATUS.DISABLED]: {
    label: 'Disabled',
    variant: 'neutral' as const,
    value: USER_STATUS.DISABLED,
    showDot: true,
  },
} as const

export const USER_STATUS_OPTIONS = [
  { label: 'Enabled', value: String(USER_STATUS.ENABLED) },
  { label: 'Disabled', value: String(USER_STATUS.DISABLED) },
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
    label: 'User',
    value: USER_ROLE.USER,
    icon: User,
  },
  [USER_ROLE.ADMIN]: {
    label: 'Admin',
    value: USER_ROLE.ADMIN,
    icon: Users,
  },
  [USER_ROLE.ROOT]: {
    label: 'Root',
    value: USER_ROLE.ROOT,
    icon: Shield,
  },
} as const

export const USER_ROLE_OPTIONS = [
  { label: 'User', value: String(USER_ROLE.USER), icon: User },
  { label: 'Admin', value: String(USER_ROLE.ADMIN), icon: Users },
  { label: 'Root', value: String(USER_ROLE.ROOT), icon: Shield },
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
  { key: 'oidc_id', label: 'OIDC ID' },
  { key: 'wechat_id', label: 'WeChat ID' },
  { key: 'email', label: 'Email' },
  { key: 'telegram_id', label: 'Telegram ID' },
] as const

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  NO_USER: 'No user selected',
  LOAD_FAILED: 'Failed to load users',
  SEARCH_FAILED: 'Failed to search users',
  CREATE_FAILED: 'Failed to create user',
  UPDATE_FAILED: 'Failed to update user',
  DELETE_FAILED: 'Failed to delete user',
} as const

// ============================================================================
// Success Messages
// ============================================================================

export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
} as const
