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
import { type TFunction } from 'i18next'
import { type StatusBadgeProps } from '@/components/status-badge'
import {
  opsConsoleGhostIconButtonClassName,
  opsConsoleOutlineButtonClassName,
} from '@/lib/ops-ui-styles'

// ============================================================================
// Redemption Status Configuration
// ============================================================================

export const REDEMPTION_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  USED: 3,
} as const

export const REDEMPTION_STATUS_VALUES = Object.values(REDEMPTION_STATUS).map(
  (value) => String(value)
) as `${number}`[]

// labelKey values are i18n keys; use t(config.labelKey) in components
export const REDEMPTION_STATUSES: Record<
  number,
  Pick<StatusBadgeProps, 'variant' | 'showDot'> & {
    labelKey: string
    value: number
  }
> = {
  [REDEMPTION_STATUS.ENABLED]: {
    labelKey: 'Redemption status pending',
    variant: 'success',
    value: REDEMPTION_STATUS.ENABLED,
    showDot: true,
  },
  [REDEMPTION_STATUS.DISABLED]: {
    labelKey: 'Redemption status disabled',
    variant: 'neutral',
    value: REDEMPTION_STATUS.DISABLED,
    showDot: true,
  },
  [REDEMPTION_STATUS.USED]: {
    labelKey: 'Redemption status redeemed',
    variant: 'neutral',
    value: REDEMPTION_STATUS.USED,
    showDot: true,
  },
} as const

// Virtual status filter value for expired redemption codes
// Note: "Expired" is not a real DB status, it's computed from expired_time
export const REDEMPTION_FILTER_EXPIRED = 'expired'

export function getRedemptionStatusOptions(t: TFunction) {
  return [
    ...Object.values(REDEMPTION_STATUSES).map((config) => ({
      label: t(config.labelKey),
      value: String(config.value),
    })),
    {
      label: t('Redemption status expired'),
      value: REDEMPTION_FILTER_EXPIRED,
    },
  ]
}

/** Light ops console outline buttons (Sheet / dialogs). */
export const REDEMPTION_OUTLINE_BUTTON_CLASS = opsConsoleOutlineButtonClassName

/** Light ops console row action trigger (ghost icon). */
export const REDEMPTION_GHOST_ICON_BUTTON_CLASS =
  opsConsoleGhostIconButtonClassName

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

// i18n keys; use t(ERROR_MESSAGES.xxx) when displaying. For form schema with interpolation use getRedemptionFormErrorMessages(t).
export const ERROR_MESSAGES = {
  UNEXPECTED: 'Redemption error unexpected',
  LOAD_FAILED: 'Redemption codes load failed',
  SEARCH_FAILED: 'Redemption codes search failed',
  CREATE_FAILED: 'Redemption code create failed',
  UPDATE_FAILED: 'Redemption code update failed',
  DELETE_FAILED: 'Redemption code delete failed',
  DELETE_INVALID_FAILED: 'Redemption codes delete invalid failed',
  STATUS_UPDATE_FAILED: 'Redemption code status update failed',
  NAME_LENGTH_INVALID:
    'Redemption form name length must be between {{min}} and {{max}} characters',
  COUNT_INVALID:
    'Redemption form batch count must be between {{min}} and {{max}}',
  EXPIRED_TIME_INVALID: 'Redemption form expiry cannot be before now',
} as const

/** For form schema only: returns translated messages with interpolation. */
export function getRedemptionFormErrorMessages(t: TFunction) {
  return {
    NAME_LENGTH_INVALID: t(ERROR_MESSAGES.NAME_LENGTH_INVALID, {
      min: REDEMPTION_VALIDATION.NAME_MIN_LENGTH,
      max: REDEMPTION_VALIDATION.NAME_MAX_LENGTH,
    }),
    COUNT_INVALID: t(ERROR_MESSAGES.COUNT_INVALID, {
      min: REDEMPTION_VALIDATION.COUNT_MIN,
      max: REDEMPTION_VALIDATION.COUNT_MAX,
    }),
    EXPIRED_TIME_INVALID: t(ERROR_MESSAGES.EXPIRED_TIME_INVALID),
  } as const
}

// ============================================================================
// Success Messages (i18n keys; use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  REDEMPTION_CREATED: 'Resource redemption code created successfully',
  REDEMPTION_UPDATED: 'Resource redemption code updated successfully',
  REDEMPTION_DELETED: 'Resource redemption code deleted successfully',
  REDEMPTION_ENABLED: 'Resource redemption code enabled successfully',
  REDEMPTION_DISABLED: 'Resource redemption code disabled successfully',
  COPY_SUCCESS: 'Redemption copy success',
} as const
