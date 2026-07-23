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
import type { TFunction } from 'i18next'

import type { StatusBadgeProps } from '@/components/status-badge'

// ============================================================================
// Registration Code Status Configuration
// ============================================================================

export const REGISTRATION_CODE_STATUS = {
  UNUSED: 1,
  USED: 3,
} as const

export const REGISTRATION_CODE_STATUS_VALUES = Object.values(
  REGISTRATION_CODE_STATUS
).map((value) => String(value)) as `${number}`[]

// labelKey values are i18n keys; use t(config.labelKey) in components
export const REGISTRATION_CODE_STATUSES: Record<
  number,
  Pick<StatusBadgeProps, 'variant'> & {
    labelKey: string
    value: number
  }
> = {
  [REGISTRATION_CODE_STATUS.UNUSED]: {
    labelKey: 'Unused',
    variant: 'success',
    value: REGISTRATION_CODE_STATUS.UNUSED,
  },
  [REGISTRATION_CODE_STATUS.USED]: {
    labelKey: 'Used',
    variant: 'neutral',
    value: REGISTRATION_CODE_STATUS.USED,
  },
} as const

// Virtual status filter value for expired registration codes
// Note: "Expired" is not a real DB status, it's computed from expired_time
export const REGISTRATION_CODE_FILTER_EXPIRED = 'expired'

export const REGISTRATION_CODE_FILTER_VALUES = [
  String(REGISTRATION_CODE_STATUS.UNUSED),
  String(REGISTRATION_CODE_STATUS.USED),
  REGISTRATION_CODE_FILTER_EXPIRED,
] as const

export function getRegistrationCodeStatusOptions(t: TFunction) {
  return [
    ...Object.values(REGISTRATION_CODE_STATUSES).map((config) => ({
      label: t(config.labelKey),
      value: String(config.value),
    })),
    {
      label: t('Expired'),
      value: REGISTRATION_CODE_FILTER_EXPIRED,
    },
  ]
}

// ============================================================================
// Validation Constants
// ============================================================================

export const REGISTRATION_CODE_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 20,
  COUNT_MIN: 1,
  COUNT_MAX: 100,
} as const

// ============================================================================
// Error Messages
// ============================================================================

// i18n keys; use t(ERROR_MESSAGES.xxx) when displaying. For form schema with interpolation use getRegistrationCodeFormErrorMessages(t).
export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_FAILED: 'Failed to load registration codes',
  SEARCH_FAILED: 'Failed to search registration codes',
  CREATE_FAILED: 'Failed to create registration code',
  UPDATE_FAILED: 'Failed to update registration code',
  DELETE_FAILED: 'Failed to delete registration code',
  DELETE_INVALID_FAILED: 'Failed to delete invalid registration codes',
  NAME_LENGTH_INVALID: 'Name must be between {{min}} and {{max}} characters',
  COUNT_INVALID: 'Count must be between {{min}} and {{max}}',
  EXPIRED_TIME_INVALID: 'Expired time cannot be earlier than current time',
} as const

/** For form schema only: returns translated messages with interpolation. */
export function getRegistrationCodeFormErrorMessages(t: TFunction) {
  return {
    NAME_LENGTH_INVALID: t(ERROR_MESSAGES.NAME_LENGTH_INVALID, {
      min: REGISTRATION_CODE_VALIDATION.NAME_MIN_LENGTH,
      max: REGISTRATION_CODE_VALIDATION.NAME_MAX_LENGTH,
    }),
    COUNT_INVALID: t(ERROR_MESSAGES.COUNT_INVALID, {
      min: REGISTRATION_CODE_VALIDATION.COUNT_MIN,
      max: REGISTRATION_CODE_VALIDATION.COUNT_MAX,
    }),
    EXPIRED_TIME_INVALID: t(ERROR_MESSAGES.EXPIRED_TIME_INVALID),
  } as const
}

// ============================================================================
// Success Messages (i18n keys; use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  REGISTRATION_CODE_CREATED: 'Registration code(s) created successfully',
  REGISTRATION_CODE_UPDATED: 'Registration code updated successfully',
  REGISTRATION_CODE_DELETED: 'Registration code deleted successfully',
  COPY_SUCCESS: 'Copied to clipboard',
} as const
