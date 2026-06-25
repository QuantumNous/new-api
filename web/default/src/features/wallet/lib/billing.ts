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
import { formatTimestampToDate } from '@/lib/format'
import type { StatusBadgeProps } from '@/components/status-badge'
import type { TopupStatus } from '../types'

// ============================================================================
// Billing Utility Functions
// ============================================================================

interface StatusConfig {
  variant: StatusBadgeProps['variant']
  label: string
}

/**
 * Status badge configuration
 */
export const STATUS_CONFIG: Record<TopupStatus, StatusConfig> = {
  success: {
    variant: 'success',
    label: 'Success',
  },
  pending: {
    variant: 'warning',
    label: 'Pending',
  },
  expired: {
    variant: 'danger',
    label: 'Expired',
  },
}

/**
 * Get status badge configuration
 */
export function getStatusConfig(status: TopupStatus): StatusConfig {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending
}

/**
 * Payment method display names
 */
export const PAYMENT_METHOD_NAMES: Record<string, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  alipay: 'Alipay',
  wxpay: 'WeChat Pay',
  waffo: 'Waffo',
  waffo_pancake: 'Waffo (Pancake)',
  platega: 'Russian SBP QR',
  clink: 'Clink',
  creem: 'Creem',
  crypto: 'Crypto (USDT)',
  custom1: 'Custom 1',
  custom2: 'Custom 2',
  custom3: 'Custom 3',
}

/** Epay methods store `money` in CNY; display uses USD recharge amount instead. */
const CNY_METHODS = new Set(['alipay', 'wxpay', 'custom1', 'custom2', 'custom3'])

/** Platega SBP QR stores `money` in RUB. */
const RUB_METHODS = new Set(['platega'])

/**
 * Format the fiat amount actually charged (Amount Paid column).
 */
export function formatPaidAmount(
  money: number,
  method: string,
  amount: number
): string {
  if (CNY_METHODS.has(method)) {
    return amount > 0 ? `$${amount.toFixed(2)}` : '—'
  }
  if (RUB_METHODS.has(method)) {
    if (money <= 0) return '—'
    return `₽${money.toFixed(2)}`
  }
  if (money <= 0) return '—'
  return `$${money.toFixed(2)}`
}

/**
 * Get payment method display name
 */
export function getPaymentMethodName(
  method: string,
  t?: (key: string) => string
): string {
  const name = PAYMENT_METHOD_NAMES[method] || method
  return t ? t(name) : name
}

/**
 * Format timestamp to readable date string
 */
export function formatTimestamp(timestamp: number): string {
  return formatTimestampToDate(timestamp)
}
