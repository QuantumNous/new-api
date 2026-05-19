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
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Hash, Coins, Layers, Gauge, Zap, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getRollingDateRange, type TimeGranularity } from '@/lib/time'
import { formatNumber, formatQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { Skeleton } from '@/components/ui/skeleton'
import { getTokenQuotaData } from '@/features/dashboard/api'
import {
  TIME_GRANULARITY_OPTIONS,
  TIME_RANGE_PRESETS,
} from '@/features/dashboard/constants'
import {
  getDefaultDays,
  getSavedGranularity,
  saveGranularity,
  calculateDashboardStats,
  safeDivide,
} from '@/features/dashboard/lib'
import type { TokenQuotaDataItem, QuotaDataItem } from '@/features/dashboard/types'
import { ConsumptionDistributionChart } from '../models/consumption-distribution-chart'
import { ModelCharts } from '../models/model-charts'

/** Map TokenQuotaDataItem → QuotaDataItem so existing chart functions can be reused */
function mapToQuotaData(items: TokenQuotaDataItem[]): QuotaDataItem[] {
  return items.map((item) => ({
    model_name: item.token_name || `key-${item.token_id ?? 'unknown'}`,
    created_at: item.created_at,
    count: item.count,
    quota: item.quota,
    token_used: item.token_used,
  }))
}

const TOP_KEY_LIMIT_OPTIONS = [5, 10, 20, 50]

export function KeyCharts() {
  const { t } = useTranslation()

  const userRole = useAuthStore((state) => state.auth.user?.role)
  const isAdmin = Boolean(userRole && userRole >= ROLE.ADMIN)

  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>(() =>
    getSavedGranularity()
  )
  const [selectedRange, setSelectedRange] = useState<number>(() =>
    getDefaultDays(timeGranularity)
  )
  const [topKeyLimit, setTopKeyLimit] = useState(10)
  const [timeRange, setTimeRange] = useState(() => {
    const days = getDefaultDays(timeGranularity)
    const { start, end } = getRollingDateRange(days)
    return {
      start_timestamp: Math.floor(start.getTime() / 1000),
      end_timestamp: Math.floor(end.getTime() / 1000),
    }
  })

  const handleRangeChange = useCallback((days: number) => {
    setSelectedRange(days)
    const { start, end } = getRollingDateRange(days)
    setTimeRange({
      start_timestamp: Math.floor(start.getTime() / 1000),
      end_timestamp: Math.floor(end.getTime() / 1000),
    })
  }, [])

  const handleGranularityChange = useCallback(
    (g: TimeGranularity) => {
      setTimeGranularity(g)
      saveGranularity(g)
      const days = getDefaultDays(g)
      if (days !== selectedRange) handleRangeChange(days)
    },
    [selectedRange, handleRangeChange]
  )

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['dashboard', 'token-quota', timeRange, isAdmin],
    queryFn: () => getTokenQuotaData(timeRange, isAdmin),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })

  const tokenData: TokenQuotaDataItem[] = isLoading ? [] : (rawData ?? [])
  const mappedData: QuotaDataItem[] = useMemo(
    () => mapToQuotaData(tokenData),
    [tokenData]
  )
  const topNKeySet = useMemo(() => {
    const totals = new Map<string, number>()
    tokenData.forEach((item) => {
      const key = item.token_name || `key-${item.token_id ?? 'unknown'}`
      totals.set(key, (totals.get(key) ?? 0) + (item.quota ?? 0))
    })

    return new Set(
      Array.from(totals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topKeyLimit)
        .map(([key]) => key)
    )
  }, [tokenData, topKeyLimit])
  const filteredMappedData = useMemo(
    () => mappedData.filter((item) => topNKeySet.has(item.model_name ?? '')),
    [mappedData, topNKeySet]
  )

  // Aggregate stats for the stat cards row
  const stats = useMemo(() => calculateDashboardStats(tokenData), [tokenData])
  const timeRangeMinutes = useMemo(
    () => (timeRange.end_timestamp - timeRange.start_timestamp) / 60,
    [timeRange]
  )

  const statCards = [
    {
      key: 'count',
      title: t('Total Count'),
      desc: t('Statistical count'),
      icon: Hash,
      value: formatNumber(stats.totalCount),
    },
    {
      key: 'quota',
      title: t('Total Quota'),
      desc: t('Statistical quota'),
      icon: Coins,
      value: formatQuota(stats.totalQuota),
    },
    {
      key: 'tokens',
      title: t('Total Tokens'),
      desc: t('Statistical tokens'),
      icon: Layers,
      value: formatNumber(stats.totalTokens),
    },
    {
      key: 'avgRpm',
      title: t('Average RPM'),
      desc: t('Requests per minute'),
      icon: Gauge,
      value: formatNumber(safeDivide(stats.totalCount, timeRangeMinutes)),
    },
    {
      key: 'avgTpm',
      title: t('Average TPM'),
      desc: t('Tokens per minute'),
      icon: Zap,
      value: formatNumber(safeDivide(stats.totalTokens, timeRangeMinutes)),
    },
  ]

  return (
    <div className='space-y-3 sm:space-y-4'>
      {/* Filter bar */}
      <div className='flex items-center gap-1.5 overflow-x-auto pb-1 sm:gap-2'>
        {/* Time range presets */}
        <div className='flex shrink-0 items-center gap-1.5 rounded-lg border p-0.5'>
          {TIME_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              type='button'
              onClick={() => handleRangeChange(preset.days)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedRange === preset.days
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t(preset.label)}
            </button>
          ))}
        </div>

        {/* Time granularity */}
        <div className='flex shrink-0 items-center gap-1.5 rounded-lg border p-0.5'>
          {TIME_GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type='button'
              onClick={() => handleGranularityChange(opt.value as TimeGranularity)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                timeGranularity === opt.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t(opt.label)}
            </button>
          ))}
        </div>

        <div className='flex shrink-0 items-center gap-1.5 rounded-lg border p-0.5'>
          <span className='text-muted-foreground px-2 text-xs font-medium'>
            {t('Top Keys')}
          </span>
          {TOP_KEY_LIMIT_OPTIONS.map((limit) => (
            <button
              key={limit}
              type='button'
              onClick={() => setTopKeyLimit(limit)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                topKeyLimit === limit
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t('Top {{count}}', { count: limit })}
            </button>
          ))}
        </div>

        {isLoading && (
          <Loader2 className='text-muted-foreground size-4 animate-spin' />
        )}
      </div>

      {/* Stat cards */}
      <div className='overflow-hidden rounded-lg border'>
        <div className='divide-border/60 grid grid-cols-2 divide-x sm:grid-cols-3 lg:grid-cols-5'>
          {statCards.map((card, idx) => {
            const Icon = card.icon
            return (
              <div
                key={card.key}
                className={`px-3 py-2.5 sm:px-5 sm:py-4 ${
                  idx === statCards.length - 1 && statCards.length % 2 !== 0
                    ? 'col-span-2 sm:col-span-1'
                    : ''
                }`}
              >
                <div className='flex items-center gap-2'>
                  <Icon className='text-muted-foreground/60 size-3.5 shrink-0' />
                  <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
                    {card.title}
                  </div>
                </div>
                {isLoading ? (
                  <div className='mt-2 space-y-1.5'>
                    <Skeleton className='h-7 w-20' />
                    <Skeleton className='h-3.5 w-28' />
                  </div>
                ) : (
                  <>
                    <div className='text-foreground mt-1.5 font-mono text-lg font-bold tracking-tight tabular-nums sm:mt-2 sm:text-2xl'>
                      {card.value}
                    </div>
                    <div className='text-muted-foreground/60 mt-1 hidden text-xs md:block'>
                      {card.desc}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Quota distribution over time (bar / area) */}
      <ConsumptionDistributionChart
        data={filteredMappedData}
        loading={isLoading}
        timeGranularity={timeGranularity}
      />

      {/* Key analytics: trend / proportion / top */}
      <ModelCharts
        data={filteredMappedData}
        loading={isLoading}
        timeGranularity={timeGranularity}
        title={t('API Key Analytics')}
      />
    </div>
  )
}
