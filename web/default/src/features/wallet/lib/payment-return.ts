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
import type { UserWalletData } from '../types'

export const PAYMENT_RETURN_STORAGE_KEY = 'wallet_payment_return'

export type PaymentReturnScope = 'topup' | 'subscription'
export type PaymentReturnStatus = 'success' | 'pending' | 'fail'

export interface PaymentReturnState {
  showHistory: boolean
  pay?: PaymentReturnStatus
  scope?: PaymentReturnScope
}

export interface PaymentReturnMarker {
  scope: PaymentReturnScope
  source: 'new_tab' | 'same_tab'
  createdAt: number
  status?: PaymentReturnStatus
}

export function isPaymentReturnScope(
  value: unknown
): value is PaymentReturnScope {
  return value === 'topup' || value === 'subscription'
}

export function isPaymentReturnStatus(
  value: unknown
): value is PaymentReturnStatus {
  return value === 'success' || value === 'pending' || value === 'fail'
}

export function toBooleanSearchValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return undefined
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

export function parsePaymentReturnState(search: Record<string, unknown>) {
  const showHistory = toBooleanSearchValue(search.show_history) === true
  const pay = isPaymentReturnStatus(search.pay) ? search.pay : undefined
  const scope = isPaymentReturnScope(search.scope) ? search.scope : undefined

  if (!showHistory && !pay && !scope) {
    return null
  }

  return {
    showHistory,
    pay,
    scope,
  } satisfies PaymentReturnState
}

export function markPaymentFlowStart(
  scope: PaymentReturnScope,
  source: 'new_tab' | 'same_tab'
) {
  if (typeof window === 'undefined') return

  const marker: PaymentReturnMarker = {
    scope,
    source,
    createdAt: Date.now(),
  }

  try {
    window.localStorage.setItem(
      PAYMENT_RETURN_STORAGE_KEY,
      JSON.stringify(marker)
    )
  } catch {
    /* ignore */
  }
}

export function completePaymentReturnMarker(
  scope: PaymentReturnScope,
  status?: PaymentReturnStatus
) {
  if (typeof window === 'undefined') return

  const marker: PaymentReturnMarker = {
    scope,
    source: 'same_tab',
    createdAt: Date.now(),
    status,
  }

  try {
    window.localStorage.setItem(
      PAYMENT_RETURN_STORAGE_KEY,
      JSON.stringify(marker)
    )
  } catch {
    /* ignore */
  }
}

export function readPaymentReturnMarker(): PaymentReturnMarker | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(PAYMENT_RETURN_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PaymentReturnMarker
    if (!isPaymentReturnScope(parsed?.scope)) return null
    if (typeof parsed?.createdAt !== 'number') return null
    if (
      parsed.status !== undefined &&
      !isPaymentReturnStatus(parsed.status)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPaymentReturnMarker() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PAYMENT_RETURN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function hasRecentPaymentMarker(
  marker: PaymentReturnMarker | null,
  now = Date.now(),
  maxAgeMs = 10 * 60 * 1000
) {
  if (!marker) return false
  return now-marker.createdAt >= 0 && now-marker.createdAt <= maxAgeMs
}

export function hasQuotaChanged(
  previousUser: UserWalletData | null,
  nextUser: UserWalletData | null
) {
  if (!previousUser || !nextUser) return false

  return (
    previousUser.quota !== nextUser.quota ||
    previousUser.used_quota !== nextUser.used_quota ||
    previousUser.aff_quota !== nextUser.aff_quota
  )
}
