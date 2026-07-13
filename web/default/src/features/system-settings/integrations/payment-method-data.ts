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
export type PaymentMethodData = {
  name: string
  type: string
  icon?: string
  min_topup?: string
  color?: string
  epay_signed_timestamp?: string
}

export function isPaymentMethodData(item: unknown): item is PaymentMethodData {
  return (
    typeof item === 'object' &&
    item !== null &&
    'name' in item &&
    'type' in item &&
    typeof item.name === 'string' &&
    typeof item.type === 'string' &&
    (!('icon' in item) || typeof item.icon === 'string') &&
    (!('min_topup' in item) || typeof item.min_topup === 'string') &&
    (!('color' in item) || typeof item.color === 'string') &&
    (!('epay_signed_timestamp' in item) ||
      typeof item.epay_signed_timestamp === 'string')
  )
}

export function isEpaySignedTimestampEnabled(method: PaymentMethodData) {
  return method.epay_signed_timestamp === 'true'
}

export function isEpayPaymentMethodType(type: string) {
  return type !== '' && type !== 'stripe' && type !== 'waffo_pancake'
}

export function setEpaySignedTimestamp(
  method: PaymentMethodData,
  enabled: boolean
): PaymentMethodData {
  const result = { ...method }
  delete result.epay_signed_timestamp
  if (enabled && isEpayPaymentMethodType(method.type)) {
    result.epay_signed_timestamp = 'true'
  }
  return result
}
