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
// Market Model Status Configuration
// ============================================================================

export const MARKET_MODEL_STATUS = {
  AVAILABLE: 1,
  COMING_SOON: 2,
  DISABLED: 3,
} as const

export const MARKET_MODEL_STATUS_VALUES = Object.values(MARKET_MODEL_STATUS).map(
  (value) => String(value)
) as `${number}`[]

// labelKey values are i18n keys; use t(config.labelKey) in components
export const MARKET_MODEL_STATUSES: Record<
  number,
  Pick<StatusBadgeProps, 'variant'> & {
    labelKey: string
    value: number
  }
> = {
  [MARKET_MODEL_STATUS.AVAILABLE]: {
    labelKey: 'Available',
    variant: 'success',
    value: MARKET_MODEL_STATUS.AVAILABLE,
  },
  [MARKET_MODEL_STATUS.COMING_SOON]: {
    labelKey: 'Coming Soon',
    variant: 'warning',
    value: MARKET_MODEL_STATUS.COMING_SOON,
  },
  [MARKET_MODEL_STATUS.DISABLED]: {
    labelKey: 'Disabled',
    variant: 'neutral',
    value: MARKET_MODEL_STATUS.DISABLED,
  },
} as const

export const MARKET_MODEL_FILTER_VALUES = [
  String(MARKET_MODEL_STATUS.AVAILABLE),
  String(MARKET_MODEL_STATUS.COMING_SOON),
  String(MARKET_MODEL_STATUS.DISABLED),
] as const

export function getMarketModelStatusOptions(t: TFunction) {
  return Object.values(MARKET_MODEL_STATUSES).map((config) => ({
    label: t(config.labelKey),
    value: String(config.value),
  }))
}

// ============================================================================
// Unit & Currency Options
// ============================================================================

export const MARKET_MODEL_UNITS = [
  'token',
  'image',
  'second',
  'char',
] as const

export const MARKET_MODEL_CURRENCIES = ['CNY', 'USD'] as const

export function getMarketModelUnitOptions(t: TFunction) {
  const labels: Record<string, string> = {
    token: t('Token'),
    image: t('Image'),
    second: t('Second'),
    char: t('Character'),
  }
  return MARKET_MODEL_UNITS.map((u) => ({ label: labels[u] ?? u, value: u }))
}

export function getMarketModelCurrencyOptions(_t: TFunction) {
  return MARKET_MODEL_CURRENCIES.map((c) => ({ label: c, value: c }))
}

// ============================================================================
// Price Formatting (minor units -> major with currency symbol)
// ============================================================================

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
}

export function formatMarketPrice(minor: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? ''
  return `${symbol}${(minor / 100).toFixed(2)}`
}

// ============================================================================
// Validation Constants
// ============================================================================

export const MARKET_MODEL_VALIDATION = {
  MODEL_MAX_LENGTH: 255,
  CATEGORY_MAX_LENGTH: 32,
  PROVIDER_MAX_LENGTH: 64,
  TAGS_MAX_LENGTH: 255,
} as const

// ============================================================================
// Error Messages (i18n keys; use t(ERROR_MESSAGES.xxx) when displaying)
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_FAILED: 'Failed to load model market items',
  CREATE_FAILED: 'Failed to create model market item',
  UPDATE_FAILED: 'Failed to update model market item',
  DELETE_FAILED: 'Failed to delete model market item',
  MODEL_REQUIRED: 'Model is required',
  MODEL_TOO_LONG: 'Model must be <= 255 characters',
  CATEGORY_REQUIRED: 'Category is required',
  CATEGORY_TOO_LONG: 'Category must be <= 32 characters',
  PROVIDER_TOO_LONG: 'Provider must be <= 64 characters',
  TAGS_TOO_LONG: 'Tags must be <= 255 characters',
  PRICE_INVALID: 'Price must be >= 0',
  TRIAL_INVALID: 'Trial quota must be >= 0',
  METADATA_INVALID: 'Metadata must be valid JSON',
} as const

// ============================================================================
// Success Messages (i18n keys; use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  MARKET_MODEL_CREATED: 'Model market item created successfully',
  MARKET_MODEL_UPDATED: 'Model market item updated successfully',
  MARKET_MODEL_DELETED: 'Model market item deleted successfully',
} as const
