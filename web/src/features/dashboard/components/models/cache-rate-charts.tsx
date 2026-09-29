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
import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import { Database, DatabaseZap, Gauge } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getChannelQuotaDates } from '@/features/dashboard/api'
import { DEFAULT_TIME_GRANULARITY } from '@/features/dashboard/constants'
import {
  getDefaultDays,
  processCacheRateChartData,
} from '@/features/dashboard/lib'
import type {
  CacheRateChartRow,
  CacheRateDimension,
  CacheRateMetric,
  DashboardFilters,
  QuotaDataItem,
} from '@/features/dashboard/types'
import { ROLE } from '@/lib/roles'
import { createServerError } from '@/lib/server-error-message'
import { computeTimeRange } from '@/lib/time'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'
import { useAuthStore } from '@/stores/auth-store'

interface CacheRateChartsProps {
  filters?: DashboardFilters
  data: QuotaDataItem[]
  loading?: boolean
  timeGranularity?: DashboardFilters['time_granularity']
}

const METRIC_OPTIONS: Array<{
  value: CacheRateMetric
  labelKey: string
}> = [
  { value: 'read', labelKey: 'Cache Read Rate' },
  { value: 'creation', labelKey: 'Cache Creation Rate' },
]

const DIMENSION_OPTIONS: Array<{
  value: CacheRateDimension
  labelKey: string
  icon: typeof Database
}> = [
  { value: 'model', labelKey: 'By model', icon: Database },
  { value: 'channel', labelKey: 'By channel', icon: DatabaseZap },
]

export function CacheRateCharts(props: CacheRateChartsProps) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()
  const isAdmin = useAuthStore((state) => {
    const role = state.auth.user?.role
    return role != null && role >= ROLE.ADMIN
  })
  const [dimension, setDimension] = useState<CacheRateDimension>('model')
  const [metric, setMetric] = useState<CacheRateMetric>('read')
  const timeGranularity =
    props.timeGranularity ?? props.filters?.time_granularity ??
    DEFAULT_TIME_GRANULARITY

  const timeRange = useMemo(
    () =>
      computeTimeRange(
        getDefaultDays(props.filters?.time_granularity),
        props.filters?.start_timestamp,
        props.filters?.end_timestamp
      ),
    [props.filters]
  )

  const channelUsername = props.filters?.username
  const channelQuery = useQuery({
    queryKey: [
      'dashboard-channel-quota-data',
      timeRange.start_timestamp,
      timeRange.end_timestamp,
      channelUsername,
    ],
    queryFn: async () => {
      const response = await getChannelQuotaDates({
        start_timestamp: timeRange.start_timestamp,
        end_timestamp: timeRange.end_timestamp,
        username: channelUsername,
      })
      if (!response.success) {
        throw createServerError(
          response,
          response.message || t('Failed to load cache analytics')
        )
      }
      return response.data ?? []
    },
    enabled: isAdmin && dimension === 'channel',
    staleTime: 60 * 1000,
  })

  const rows: CacheRateChartRow[] = useMemo(() => {
    if (dimension === 'channel') {
      // Two channels can share one display name; keep them distinct by
      // suffixing the channel id, but only for channel ids that are not the
      // name's first owner, so a channel's own rows across time buckets
      // always stay in one series.
      const nameFirstChannel = new Map<string, number>()
      return (channelQuery.data ?? []).map((item) => {
        const name = item.channel_name || `channel-${item.channel_id}`
        const firstChannel = nameFirstChannel.get(name)
        if (firstChannel === undefined) {
          nameFirstChannel.set(name, item.channel_id)
        }
        const duplicateOfOtherChannel =
          firstChannel !== undefined && firstChannel !== item.channel_id
        return {
          series: duplicateOfOtherChannel
            ? `${name} (#${item.channel_id})`
            : name,
          created_at: Number(item.created_at) || 0,
          prompt_tokens: Number(item.prompt_tokens) || 0,
          cache_tokens: Number(item.cache_tokens) || 0,
          cache_creation_tokens: Number(item.cache_creation_tokens) || 0,
        }
      })
    }
    return props.data.map((item) => ({
      series: item.model_name || 'Unknown',
      created_at: Number(item.created_at) || 0,
      prompt_tokens: Number(item.prompt_tokens) || 0,
      cache_tokens: Number(item.cache_tokens) || 0,
      cache_creation_tokens: Number(item.cache_creation_tokens) || 0,
    }))
  }, [dimension, channelQuery.data, props.data])

  const loading =
    dimension === 'channel'
      ? channelQuery.isFetching
      : Boolean(props.loading)

  const spec = useMemo(
    () =>
      processCacheRateChartData(loading ? [] : rows, {
        metric,
        timeGranularity,
        t,
      }),
    [rows, loading, metric, timeGranularity, t]
  )

  const hasRatePoints = !loading && rows.some((row) => row.prompt_tokens > 0)
  const channelError = dimension === 'channel' && channelQuery.isError
  let chartState = 'ready'
  if (loading) {
    chartState = 'loading'
  } else if (channelError) {
    chartState = 'error'
  }
  const chartKey = [
    dimension,
    metric,
    chartState,
    rows.length,
    resolvedTheme,
  ].join('-')

  let chartBody: ReactNode = null
  if (loading) {
    chartBody = <Skeleton className='h-full w-full' />
  } else if (channelError) {
    chartBody = (
      <Empty className='h-full border-0 py-12'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <Database />
          </EmptyMedia>
          <EmptyTitle>{t('Failed to load cache analytics')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  } else if (!hasRatePoints) {
    chartBody = (
      <Empty className='h-full border-0 py-12'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <Database />
          </EmptyMedia>
          <EmptyTitle>{t('No cache data available')}</EmptyTitle>
          <EmptyDescription>{t('No data available')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else if (themeReady) {
    chartBody = (
      <VChart
        key={chartKey}
        spec={{
          ...spec,
          theme: resolvedTheme === 'dark' ? 'dark' : 'light',
          background: 'transparent',
        }}
        option={VCHART_OPTION}
      />
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <IconBadge tone='chart-3' size='sm'>
            <Gauge />
          </IconBadge>
          <div className='text-sm font-semibold'>{t('Cache Rate Analytics')}</div>
          <span className='text-muted-foreground text-xs'>
            {t('Share of input tokens served from or written to cache')}
          </span>
        </div>

        <div className='flex flex-wrap items-center gap-1.5'>
          <Tabs
            value={dimension}
            onValueChange={(value) =>
              setDimension(value as CacheRateDimension)
            }
            className='shrink-0'
          >
            <TabsList aria-label={t('Cache rate dimension')}>
              {DIMENSION_OPTIONS.filter(
                (option) => isAdmin || option.value !== 'channel'
              ).map((option) => {
                const Icon = option.icon
                return (
                  <TabsTrigger
                    key={option.value}
                    value={option.value}
                    className='gap-1.5 px-2.5 text-xs'
                  >
                    <Icon data-icon='inline-start' aria-hidden='true' />
                    {t(option.labelKey)}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
          <Tabs
            value={metric}
            onValueChange={(value) => setMetric(value as CacheRateMetric)}
            className='shrink-0'
          >
            <TabsList aria-label={t('Cache rate metric')}>
              {METRIC_OPTIONS.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className='px-2.5 text-xs'
                >
                  {t(option.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>{chartBody}</div>
    </div>
  )
}
