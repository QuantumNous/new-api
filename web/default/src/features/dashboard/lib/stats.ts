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
import type { QuotaDataItem } from '@/features/dashboard/types'

/**
 * Safe division: handles NaN and Infinity cases
 */
export function safeDivide(
  value: number,
  divisor: number,
  precision: number = 3
): number {
  const result = value / divisor
  if (isNaN(result) || !isFinite(result)) return 0
  const factor = Math.pow(10, precision)
  return Math.round(result * factor) / factor
}

/**
 * Calculate aggregated statistics from quota data
 */
export function calculateDashboardStats(data: QuotaDataItem[]) {
  return data.reduce(
    (acc, item) => ({
      totalQuota: acc.totalQuota + (Number(item.quota) || 0),
      totalCount: acc.totalCount + (Number(item.count) || 0),
      totalTokens: acc.totalTokens + (Number(item.token_used) || 0),
    }),
    { totalQuota: 0, totalCount: 0, totalTokens: 0 }
  )
}

/** Count distinct usernames with at least one API call in quota_data rows. */
export function countActiveAccountsFromQuotaData(data: QuotaDataItem[]): number {
  const activeUsernames = new Set<string>()

  for (const item of data) {
    if ((Number(item.count) || 0) <= 0) continue

    const username = item.username?.trim()
    if (username) {
      activeUsernames.add(username)
      continue
    }

    if (item.user_id != null) {
      activeUsernames.add(String(item.user_id))
    }
  }

  return activeUsernames.size
}

/** Whether the current account had any calls in the given quota_data rows. */
export function isAccountActiveInQuotaData(data: QuotaDataItem[]): boolean {
  return data.some((item) => (Number(item.count) || 0) > 0)
}
