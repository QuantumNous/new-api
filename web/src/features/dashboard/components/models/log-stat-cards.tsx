import { useEffect, useState } from 'react'
import { formatNumber, formatQuota } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { useModelStatCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
import {
  buildQueryParams,
  calculateDashboardStats,
  getDefaultDays,
} from '@/features/dashboard/lib'
import type {
  QuotaDataItem,
  DashboardFilters,
} from '@/features/dashboard/types'

interface LogStatCardsProps {
  filters?: DashboardFilters
  onDataUpdate?: (data: QuotaDataItem[], loading: boolean) => void
}

export function LogStatCards({ filters, onDataUpdate }: LogStatCardsProps) {
  const statCardsConfig = useModelStatCardsConfig()
  const [stats, setStats] = useState<{
    totalQuota: number
    totalCount: number
    totalTokens: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [timeRangeMinutes, setTimeRangeMinutes] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(false)
    onDataUpdate?.([], true)

    const timeRange = computeTimeRange(
      getDefaultDays(filters?.time_granularity),
      filters?.start_timestamp,
      filters?.end_timestamp
    )
    const timeDiff =
      (timeRange.end_timestamp - timeRange.start_timestamp) / 60000
    setTimeRangeMinutes(timeDiff)

    getUserQuotaDates(buildQueryParams(timeRange, filters))
      .then((res) => {
        if (!mounted) return
        const data = res?.data || []
        setStats(calculateDashboardStats(data))
        onDataUpdate?.(data, false)
      })
      .catch(() => {
        setStats(null)
        setError(true)
        onDataUpdate?.([], false)
      })
      .finally(() => mounted && setLoading(false))

    return () => {
      mounted = false
    }
  }, [filters, onDataUpdate])

  // Adapt data format to match config expectations
  const adaptedStats = {
    rpm: stats?.totalCount ?? 0,
    quota: stats?.totalQuota ?? 0,
    tpm: stats?.totalTokens ?? 0,
  }

  const items = statCardsConfig.map((config) => ({
    title: config.title,
    value:
      config.key === 'quota'
        ? formatQuota(config.getValue(adaptedStats, timeRangeMinutes))
        : formatNumber(config.getValue(adaptedStats, timeRangeMinutes)),
    desc: config.description,
    icon: config.icon,
  }))

  return (
    <Card>
      <CardContent>
        <div className='grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5'>
          {items.map((it) => {
            const Icon = it.icon
            return (
              <div
                key={it.title}
                className='group hover:bg-accent/50 -m-2 rounded-lg p-2 transition-colors'
              >
                <div className='flex items-center gap-2'>
                  <Icon className='text-muted-foreground h-4 w-4 shrink-0' />
                  <div className='text-muted-foreground truncate text-sm font-medium'>
                    {it.title}
                  </div>
                </div>

                {loading ? (
                  <div className='mt-2 space-y-2'>
                    <Skeleton className='h-8 w-28' />
                    <Skeleton className='h-4 w-36' />
                  </div>
                ) : error ? (
                  <>
                    <div className='text-muted-foreground mt-2 text-2xl font-semibold tracking-tight tabular-nums'>
                      --
                    </div>
                    <div className='text-muted-foreground mt-1 hidden text-xs md:block'>
                      {it.desc}
                    </div>
                  </>
                ) : (
                  <>
                    <div className='mt-2 text-2xl font-semibold tracking-tight tabular-nums'>
                      {it.value}
                    </div>
                    <div className='text-muted-foreground mt-1 hidden text-xs md:block'>
                      {it.desc}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
