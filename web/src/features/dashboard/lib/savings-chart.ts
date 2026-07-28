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
  SavingsSummary,
  SavingsTrend,
  SavingsTrendGranularity,
} from '@/features/dashboard/types'

import { savingsQuotaToCNY } from './savings.ts'

type DashboardTimeGranularity = 'hour' | 'day' | 'week'

export interface SavingsTrendChartPoint {
  Time: string
  BucketStart: number
  LineSegment: string | null
  Official: number | null
  Actual: number | null
  Savings: number | null
  RequestCount: number
  EstimatedRequestCount: number
  ReconstructedRequestCount: number
  CoverageRatio: number
}

export function normalizeSavingsTrendGranularity(
  granularity?: DashboardTimeGranularity,
  durationSeconds = 0
): SavingsTrendGranularity {
  return granularity === 'hour' && durationSeconds <= 48 * 3600 ? 'hour' : 'day'
}

export function calculateSavingsRate(summary: SavingsSummary): number {
  if (summary.official_quota <= 0) return 0
  return Math.min(
    1,
    Math.max(0, summary.savings_quota / summary.official_quota)
  )
}

export function buildSavingsTrendChartData(
  trend: SavingsTrend,
  quotaPerUnit: number,
  usdExchangeRate: number
): SavingsTrendChartPoint[] {
  let lineSegment = 0
  let previousBucketHasEstimates = false

  return trend.buckets.map((bucket) => {
    const hasEstimates = bucket.estimated_request_count > 0
    if (hasEstimates && !previousBucketHasEstimates) lineSegment++
    previousBucketHasEstimates = hasEstimates

    return {
      Time: formatSavingsBucketTime(bucket.start_timestamp, trend.granularity),
      BucketStart: bucket.start_timestamp,
      LineSegment: hasEstimates ? `segment-${lineSegment}` : null,
      Official: hasEstimates
        ? savingsQuotaToCNY(
            bucket.official_quota,
            quotaPerUnit,
            usdExchangeRate
          )
        : null,
      Actual: hasEstimates
        ? savingsQuotaToCNY(bucket.actual_quota, quotaPerUnit, usdExchangeRate)
        : null,
      Savings: hasEstimates
        ? savingsQuotaToCNY(bucket.savings_quota, quotaPerUnit, usdExchangeRate)
        : null,
      RequestCount: bucket.request_count,
      EstimatedRequestCount: bucket.estimated_request_count,
      ReconstructedRequestCount: bucket.reconstructed_request_count,
      CoverageRatio: bucket.coverage_ratio,
    }
  })
}

function formatSavingsBucketTime(
  timestamp: number,
  granularity: SavingsTrendGranularity
): string {
  const date = new Date(timestamp * 1000)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  if (granularity === 'hour') {
    return `${month}-${day} ${String(date.getHours()).padStart(2, '0')}:00`
  }
  return `${month}-${day}`
}
