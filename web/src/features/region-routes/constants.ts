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
*/
import type { TFunction } from 'i18next'

import type { StatusBadgeProps } from '@/components/status-badge'

// ============================================================================
// Region Route Strategy Configuration
// ============================================================================

export const REGION_ROUTE_STRATEGIES = {
  COST: 'cost',
  LATENCY: 'latency',
  AVAILABILITY: 'availability',
  FIXED: 'fixed',
} as const

export const REGION_ROUTE_STRATEGY_VALUES = [
  'cost',
  'latency',
  'availability',
  'fixed',
] as const

export const REGION_ROUTE_STRATEGY_CONFIG: Record<
  string,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string; value: string }
> = {
  [REGION_ROUTE_STRATEGIES.COST]: {
    labelKey: 'Cost',
    variant: 'info',
    value: REGION_ROUTE_STRATEGIES.COST,
  },
  [REGION_ROUTE_STRATEGIES.LATENCY]: {
    labelKey: 'Latency',
    variant: 'info',
    value: REGION_ROUTE_STRATEGIES.LATENCY,
  },
  [REGION_ROUTE_STRATEGIES.AVAILABILITY]: {
    labelKey: 'Availability',
    variant: 'info',
    value: REGION_ROUTE_STRATEGIES.AVAILABILITY,
  },
  [REGION_ROUTE_STRATEGIES.FIXED]: {
    labelKey: 'Fixed',
    variant: 'neutral',
    value: REGION_ROUTE_STRATEGIES.FIXED,
  },
}

export function getRegionRouteStrategyOptions(t: TFunction) {
  return Object.values(REGION_ROUTE_STRATEGY_CONFIG).map((config) => ({
    label: t(config.labelKey),
    value: config.value,
  }))
}

// ============================================================================
// Validation Constants
// ============================================================================

export const REGION_ROUTE_VALIDATION = {
  REGION_MAX_LENGTH: 16,
  MODEL_MAX_LENGTH: 64,
  TAG_MAX_LENGTH: 64,
  CHANNEL_IDS_MAX_LENGTH: 512,
  PRIORITY_MIN: 0,
  WEIGHT_MIN: 1,
} as const

// ============================================================================
// Error Messages (i18n keys; use t(ERROR_MESSAGES.xxx) when displaying)
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_FAILED: 'Failed to load region routes',
  CREATE_FAILED: 'Failed to create region route',
  UPDATE_FAILED: 'Failed to update region route',
  DELETE_FAILED: 'Failed to delete region route',
  REGION_REQUIRED: 'Region is required',
  STRATEGY_INVALID: 'Invalid strategy',
  TARGET_REQUIRED:
    'At least one of channel ids or tag must be specified',
  MODEL_MISSING: 'Model is required',
} as const

// ============================================================================
// Success Messages (i18n keys; use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  REGION_ROUTE_CREATED: 'Region route created successfully',
  REGION_ROUTE_UPDATED: 'Region route updated successfully',
  REGION_ROUTE_DELETED: 'Region route deleted successfully',
} as const
