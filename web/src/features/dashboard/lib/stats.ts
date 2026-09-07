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
import type {
  DashboardFilters,
  ModelMetric,
  QuotaDataItem,
} from '@/features/dashboard/types'
import { computeTimeRange } from '@/lib/time'

import { getDefaultDays } from './filters'

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

export function getDashboardDurationMinutes(
  filters?: DashboardFilters
): number {
  const timeRange = computeTimeRange(
    getDefaultDays(filters?.time_granularity),
    filters?.start_timestamp,
    filters?.end_timestamp
  )
  const durationMinutes =
    (timeRange.end_timestamp - timeRange.start_timestamp) / 60
  return Math.max(durationMinutes, 1)
}

export function buildModelMetrics(
  data: QuotaDataItem[],
  durationMinutes: number
): ModelMetric[] {
  const safeDurationMinutes = Math.max(durationMinutes, 1)
  const totals = new Map<
    string,
    { requestCount: number; totalTokens: number }
  >()

  for (const item of data) {
    const modelName = item.model_name?.trim() ?? ''
    const current = totals.get(modelName) ?? {
      requestCount: 0,
      totalTokens: 0,
    }
    current.requestCount += Number(item.count) || 0
    current.totalTokens += Number(item.token_used) || 0
    totals.set(modelName, current)
  }

  return [...totals.entries()]
    .map(([modelName, item]) => ({
      modelName,
      requestCount: item.requestCount,
      totalTokens: item.totalTokens,
      averageRpm: item.requestCount / safeDurationMinutes,
      averageTpm: item.totalTokens / safeDurationMinutes,
    }))
    .sort((a, b) => {
      if (b.totalTokens !== a.totalTokens) {
        return b.totalTokens - a.totalTokens
      }
      return a.modelName.localeCompare(b.modelName)
    })
}
