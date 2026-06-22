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
// Combo Status Configuration
// label values are i18n keys; use t(config.label) in components (e.g. StatusBadge)
// ============================================================================

export const COMBO_STATUS = {
  ENABLED: 1,
  DISABLED: 0,
} as const

export const COMBO_STATUSES: Record<
  number,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string }
> = {
  [COMBO_STATUS.ENABLED]: {
    variant: 'success',
    labelKey: 'Enabled',
  },
  [COMBO_STATUS.DISABLED]: {
    variant: 'neutral',
    labelKey: 'Disabled',
  },
} as const

export const COMBO_STATUS_OPTIONS = Object.entries(COMBO_STATUSES).map(  
  ([key, config]) => ({  
    value: key,  
    label: config.labelKey,  
  })  
)  

// ============================================================================
// Strategy Labels (i18n keys)
// ============================================================================

export const COMBO_STRATEGIES = {
  FALLBACK: 'fallback',
  RANDOM: 'random',
  WEIGHTED: 'weighted',
  ROUND_ROBIN: 'round_robin',
} as const

export const COMBO_STRATEGY_OPTIONS = [
  { value: COMBO_STRATEGIES.FALLBACK, labelKey: 'Fallback' },
  { value: COMBO_STRATEGIES.RANDOM, labelKey: 'Random' },
  { value: COMBO_STRATEGIES.WEIGHTED, labelKey: 'Weighted' },
  { value: COMBO_STRATEGIES.ROUND_ROBIN, labelKey: 'Round Robin' },
]

// ============================================================================
// Messages (i18n keys: use t(ERROR_MESSAGES.xxx) when displaying)
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred.',
  LOAD_FAILED: 'Failed to load combos.',
  CREATE_FAILED: 'Failed to create combo.',
  UPDATE_FAILED: 'Failed to update combo.',
  DELETE_FAILED: 'Failed to delete combo.',
  DELETE_MULTI_FAILED: 'Failed to delete selected combos.',
  FETCH_ONE_FAILED: 'Failed to fetch combo detail.',
  LOAD_GROUPS_FAILED: 'Failed to load groups.',
} as const

// ============================================================================
// Success Messages (i18n keys: use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  COMBO_CREATED: 'Combo created successfully.',
  COMBO_UPDATED: 'Combo updated successfully.',
  COMBO_DELETED: 'Combo deleted successfully.',
  COMBO_BATCH_DELETED: 'Selected combos deleted successfully.',
  STATUS_UPDATED: 'Status updated successfully.',
} as const
