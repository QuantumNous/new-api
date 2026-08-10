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
// Distributor Tier Configuration
// ============================================================================

export const DISTRIBUTOR_TIER = {
  STANDARD: 'standard',
  GOLD: 'gold',
  PLATINUM: 'platinum',
} as const

export const DISTRIBUTOR_TIER_CONFIG: Record<
  string,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string; value: string }
> = {
  [DISTRIBUTOR_TIER.STANDARD]: {
    labelKey: 'Standard',
    variant: 'neutral',
    value: DISTRIBUTOR_TIER.STANDARD,
  },
  [DISTRIBUTOR_TIER.GOLD]: {
    labelKey: 'Gold',
    variant: 'amber',
    value: DISTRIBUTOR_TIER.GOLD,
  },
  [DISTRIBUTOR_TIER.PLATINUM]: {
    labelKey: 'Platinum',
    variant: 'violet',
    value: DISTRIBUTOR_TIER.PLATINUM,
  },
}

export function getDistributorTierOptions(t: TFunction) {
  return Object.values(DISTRIBUTOR_TIER_CONFIG).map((config) => ({
    label: t(config.labelKey),
    value: config.value,
  }))
}

// ============================================================================
// Distributor Status Configuration
// ============================================================================

export const DISTRIBUTOR_STATUS = {
  ACTIVE: 1,
  DISABLED: 2,
} as const

export const DISTRIBUTOR_STATUS_CONFIG: Record<
  number,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string; value: number }
> = {
  [DISTRIBUTOR_STATUS.ACTIVE]: {
    labelKey: 'Active',
    variant: 'success',
    value: DISTRIBUTOR_STATUS.ACTIVE,
  },
  [DISTRIBUTOR_STATUS.DISABLED]: {
    labelKey: 'Disabled',
    variant: 'neutral',
    value: DISTRIBUTOR_STATUS.DISABLED,
  },
}

export function getDistributorStatusOptions(t: TFunction) {
  return Object.values(DISTRIBUTOR_STATUS_CONFIG).map((config) => ({
    label: t(config.labelKey),
    value: String(config.value),
  }))
}

// ============================================================================
// Distributor Price Configuration
// ============================================================================

export const DISTRIBUTOR_PRICE_CURRENCIES = ['CNY', 'USD'] as const

export const DISTRIBUTOR_PRICE_UNITS = [
  'token',
  'image',
  'second',
  'char',
] as const

export function getDistributorPriceCurrencyOptions() {
  return DISTRIBUTOR_PRICE_CURRENCIES.map((currency) => ({
    label: currency,
    value: currency,
  }))
}

export function getDistributorPriceUnitOptions(t: TFunction) {
  return DISTRIBUTOR_PRICE_UNITS.map((unit) => ({
    label: t(unit),
    value: unit,
  }))
}

// ============================================================================
// Validation Constants
// ============================================================================

export const DISTRIBUTOR_NAME_MAX_LENGTH = 64
export const DISTRIBUTOR_COMMISSION_RATE_MIN = 0
export const DISTRIBUTOR_COMMISSION_RATE_MAX = 100

// ============================================================================
// Error & Success Messages (i18n keys)
// ============================================================================

export const ERROR_MESSAGES = {
  LOAD_FAILED: 'Failed to load distributors',
  LOAD_PRICES_FAILED: 'Failed to load price overrides',
  LOAD_SUB_USERS_FAILED: 'Failed to load sub-users',
  LOAD_BILLING_FAILED: 'Failed to load billing summary',
} as const

export const SUCCESS_MESSAGES = {
  DISTRIBUTOR_CREATED: 'Distributor created successfully',
  DISTRIBUTOR_UPDATED: 'Distributor updated successfully',
  DISTRIBUTOR_DELETED: 'Distributor deleted successfully',
  PRICE_CREATED: 'Price override created successfully',
  PRICE_UPDATED: 'Price override updated successfully',
  PRICE_DELETED: 'Price override deleted successfully',
} as const
