import { type StatusBadgeProps } from '@/components/status-badge'

// ============================================================================
// Redemption Status Configuration
// ============================================================================

export const REDEMPTION_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  USED: 3,
} as const

export const REDEMPTION_STATUSES: Record<
  number,
  Pick<StatusBadgeProps, 'variant' | 'showDot'> & {
    label: string
    value: number
  }
> = {
  [REDEMPTION_STATUS.ENABLED]: {
    label: 'Unused',
    variant: 'success',
    value: REDEMPTION_STATUS.ENABLED,
    showDot: true,
  },
  [REDEMPTION_STATUS.DISABLED]: {
    label: 'Disabled',
    variant: 'neutral',
    value: REDEMPTION_STATUS.DISABLED,
    showDot: true,
  },
  [REDEMPTION_STATUS.USED]: {
    label: 'Used',
    variant: 'neutral',
    value: REDEMPTION_STATUS.USED,
    showDot: true,
  },
} as const

// Virtual status filter value for expired redemption codes
// Note: "Expired" is not a real DB status, it's computed from expired_time
export const REDEMPTION_FILTER_EXPIRED = 'expired'

export const REDEMPTION_STATUS_OPTIONS = [
  ...Object.values(REDEMPTION_STATUSES).map((config) => ({
    label: config.label,
    value: String(config.value),
  })),
  {
    label: 'Expired',
    value: REDEMPTION_FILTER_EXPIRED,
  },
]

// ============================================================================
// Validation Constants
// ============================================================================

export const REDEMPTION_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 20,
  COUNT_MIN: 1,
  COUNT_MAX: 100,
} as const

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_FAILED: 'Failed to load redemption codes',
  SEARCH_FAILED: 'Failed to search redemption codes',
  CREATE_FAILED: 'Failed to create redemption code',
  UPDATE_FAILED: 'Failed to update redemption code',
  DELETE_FAILED: 'Failed to delete redemption code',
  DELETE_INVALID_FAILED: 'Failed to delete invalid redemption codes',
  STATUS_UPDATE_FAILED: 'Failed to update redemption code status',
  NAME_LENGTH_INVALID: `Name must be between ${REDEMPTION_VALIDATION.NAME_MIN_LENGTH} and ${REDEMPTION_VALIDATION.NAME_MAX_LENGTH} characters`,
  COUNT_INVALID: `Count must be between ${REDEMPTION_VALIDATION.COUNT_MIN} and ${REDEMPTION_VALIDATION.COUNT_MAX}`,
  EXPIRED_TIME_INVALID: 'Expired time cannot be earlier than current time',
} as const

// ============================================================================
// Success Messages
// ============================================================================

export const SUCCESS_MESSAGES = {
  REDEMPTION_CREATED: 'Redemption code(s) created successfully',
  REDEMPTION_UPDATED: 'Redemption code updated successfully',
  REDEMPTION_DELETED: 'Redemption code deleted successfully',
  REDEMPTION_ENABLED: 'Redemption code enabled successfully',
  REDEMPTION_DISABLED: 'Redemption code disabled successfully',
  COPY_SUCCESS: 'Copied to clipboard',
} as const
