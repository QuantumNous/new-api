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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { opsLiveDataQueryOptions } from '@/lib/query-polling'
import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserQuotaDates } from '@/features/dashboard/api'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { StatCard } from '../ui/stat-card'
import { COCKPIT_STAT_CARD_CLASS } from './cockpit-display'

const SPARKLINE_BUCKETS = 12

function getBucketIndex(
  timestamp: number,
  start: number,
  end: number,
  bucketCount: number
): number {
  if (end <= start) return 0
  const ratio = (timestamp - start) / (end - start)
  return Math.min(bucketCount - 1, Math.max(0, Math.floor(ratio * bucketCount)))
}

function buildRequestSparkline(
  data: QuotaDataItem[],
  start: number,
  end: number
): number[] {
  const requests = Array.from({ length: SPARKLINE_BUCKETS }, () => 0)
  for (const item of data) {
    const timestamp = Number(item.created_at) || start
    const index = getBucketIndex(timestamp, start, end, SPARKLINE_BUCKETS)
    requests[index] += Number(item.count) || 0
  }
  return requests
}

export function CockpitCallTrend() {
  const { t } = useTranslation()
  const summaryTimeRange = useMemo(() => computeTimeRange(1), [])

  const usageTrendQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'summary-sparklines',
      summaryTimeRange.start_timestamp,
      summaryTimeRange.end_timestamp,
    ],
    queryFn: async () =>
      getUserQuotaDates({
        start_timestamp: summaryTimeRange.start_timestamp,
        end_timestamp: summaryTimeRange.end_timestamp,
        default_time: 'hour',
      }),
    staleTime: 60 * 1000,
    ...opsLiveDataQueryOptions,
  })

  const sparkline = useMemo(
    () =>
      buildRequestSparkline(
        usageTrendQuery.data?.data ?? [],
        summaryTimeRange.start_timestamp,
        summaryTimeRange.end_timestamp
      ),
    [
      summaryTimeRange.end_timestamp,
      summaryTimeRange.start_timestamp,
      usageTrendQuery.data?.data,
    ]
  )

  const totalCalls = useMemo(
    () => sparkline.reduce((sum, value) => sum + value, 0),
    [sparkline]
  )

  if (usageTrendQuery.isLoading) {
    return <Skeleton className='h-36 w-full rounded-xl bg-slate-200/80' />
  }

  return (
    <div className={cn('cockpit-stat-card p-4', COCKPIT_STAT_CARD_CLASS)}>
      <StatCard
        title={t('Dashboard chart trend title')}
        value={formatNumber(totalCalls)}
        description={t('Dashboard chart trend description')}
        icon={Activity}
        sparkline={sparkline}
        sparklineVariant='line'
        tone='teal'
        variant='cockpit'
      />
    </div>
  )
}
