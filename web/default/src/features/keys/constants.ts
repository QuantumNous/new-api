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
import { type StatusBadgeProps } from '@/components/status-badge'

// ============================================================================
// API Key Status Configuration
// label values are i18n keys; use t(config.label) in components (e.g. StatusBadge)
// ============================================================================

export const API_KEY_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  EXPIRED: 3,
  EXHAUSTED: 4,
} as const

export const API_KEY_STATUSES: Record<
  number,
  Pick<StatusBadgeProps, 'variant' | 'showDot'> & {
    label: string
    value: number
  }
> = {
  [API_KEY_STATUS.ENABLED]: {
    label: 'keys.status.enabled',
    variant: 'success',
    value: API_KEY_STATUS.ENABLED,
    showDot: true,
  },
  [API_KEY_STATUS.DISABLED]: {
    label: 'keys.status.disabled',
    variant: 'neutral',
    value: API_KEY_STATUS.DISABLED,
    showDot: true,
  },
  [API_KEY_STATUS.EXPIRED]: {
    label: 'keys.status.expired',
    variant: 'warning',
    value: API_KEY_STATUS.EXPIRED,
    showDot: true,
  },
  [API_KEY_STATUS.EXHAUSTED]: {
    label: 'keys.status.exhausted',
    variant: 'danger',
    value: API_KEY_STATUS.EXHAUSTED,
    showDot: true,
  },
} as const

export const API_KEY_STATUS_OPTIONS = Object.values(API_KEY_STATUSES).map(
  (config) => ({
    label: config.label,
    value: String(config.value),
  })
)

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_GROUP = '' as const

// ============================================================================
// Error Messages (i18n keys: use t(ERROR_MESSAGES.xxx) when displaying)
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'keys.toast.unexpected',
  LOAD_FAILED: 'keys.toast.load_failed',
  SEARCH_FAILED: 'keys.toast.search_failed',
  CREATE_FAILED: 'keys.toast.create_failed',
  UPDATE_FAILED: 'keys.toast.update_failed',
  DELETE_FAILED: 'keys.toast.delete_failed',
  BATCH_DELETE_FAILED: 'keys.toast.batch_delete_failed',
  STATUS_UPDATE_FAILED: 'keys.toast.status_failed',
} as const

// ============================================================================
// Success Messages (i18n keys: use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  API_KEY_CREATED: 'keys.toast.created',
  API_KEY_UPDATED: 'keys.toast.updated',
  API_KEY_DELETED: 'keys.toast.deleted',
  API_KEY_ENABLED: 'keys.toast.enabled',
  API_KEY_DISABLED: 'keys.toast.disabled',
} as const
