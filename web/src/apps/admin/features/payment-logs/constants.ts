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

import type { StatusVariant } from '@/shared/components/status-badge'

export const PAYMENT_LOG_STATUSES: Record<
  string,
  { labelKey: string; variant: StatusVariant }
> = {
  success: { labelKey: 'Completed', variant: 'success' },
  pending: { labelKey: 'Pending', variant: 'warning' },
  failed: { labelKey: 'Failed', variant: 'danger' },
  expired: { labelKey: 'Expired', variant: 'neutral' },
}

export const PAYMENT_LOG_STATUS_VALUES = [
  'success',
  'pending',
  'failed',
  'expired',
] as const

export const PAYMENT_LOG_PROVIDER_VALUES = [
  'epay',
  'stripe',
  'creem',
  'waffo',
  'waffo_pancake',
  'balance',
] as const

const PAYMENT_PROVIDER_LABEL_KEYS: Record<string, string> = {
  epay: 'Epay',
  stripe: 'Stripe',
  creem: 'Creem',
  waffo: 'Waffo',
  waffo_pancake: 'Waffo Pancake',
  balance: 'Balance',
}

export function getPaymentStatusOptions(t: TFunction) {
  return PAYMENT_LOG_STATUS_VALUES.map((value) => ({
    value,
    label: t(PAYMENT_LOG_STATUSES[value].labelKey),
  }))
}

export function getPaymentProviderOptions(t: TFunction) {
  return PAYMENT_LOG_PROVIDER_VALUES.map((value) => ({
    value,
    label: t(PAYMENT_PROVIDER_LABEL_KEYS[value]),
  }))
}

export function getPaymentStatusBadge(status: string, t: TFunction) {
  const config = PAYMENT_LOG_STATUSES[status]
  if (!config) {
    return { label: status || '-', variant: 'neutral' as StatusVariant }
  }
  return { label: t(config.labelKey), variant: config.variant }
}

export function getPaymentProviderLabel(provider: string, t: TFunction) {
  const labelKey = PAYMENT_PROVIDER_LABEL_KEYS[provider]
  return labelKey ? t(labelKey) : provider || '-'
}
