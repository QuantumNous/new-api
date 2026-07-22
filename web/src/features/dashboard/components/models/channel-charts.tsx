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
import { VChart } from '@visactor/react-vchart'
import { ArrowLeftRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import {
  DEFAULT_TIME_GRANULARITY,
  MAX_CHART_TREND_POINTS,
} from '@/features/dashboard/constants'
import { getDashboardChartColors } from '@/features/dashboard/lib/charts'
import type { DashboardFilters, QuotaDataItem } from '@/features/dashboard/types'
import type { TimeGranularity } from '@/lib/time'
import { formatChartTime } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'

import { getChannelQuotaDates } from '@/features/dashboard/api'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

type ChannelMetric = 'count' | 'tokens' | 'quota'

const CHANNEL_METRIC_OPTIONS: {
  value: ChannelMetric
  labelKey: string
}[] = [
  { value: 'count', labelKey: 'Requests' },
  { value: 'tokens', labelKey: 'Tokens' },
  { value: 'quota', labelKey: 'Quota' },
]

interface ChannelChartsProps {
  filters: DashboardFilters
}

function channelLabel(id: number): string {
  return `Channel #${id}`
}

export function ChannelCharts(props: ChannelChartsProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
  const [metric, setMetric] = useState<ChannelMetric>('count')
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)
  const [data, setData] = useState<QuotaDataItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const timeGranularity =
    props.filters.time_granularity ?? DEFAULT_TIME_GRANULARITY

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)

      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (m) => m.ThemeManager
        )
      }

      const ThemeManager = await themeManagerPromise
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }

    updateTheme()
  }, [resolvedTheme])

  useEffect(() => {
    const abortController = new AbortController()

    const startTs = props.filters.start_timestamp
    const endTs = props.filters.end_timestamp
    const isAllTime = !startTs && !endTs

    setLoading(true)
    setError(false)

    void getChannelQuotaDates({
      start_timestamp: startTs ? Math.floor(startTs.getTime() / 1000) : 0,
      end_timestamp: endTs ? Math.floor(endTs.getTime() / 1000) : 0,
      ...(isAllTime ? { all_time: 'true' } : {}),
    })
      .then((res) => {
        if (abortController.signal.aborted) return
        setData(res?.data ?? [])
      })
      .catch(() => {
        if (abortController.signal.aborted) return
        setError(true)
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [props.filters.start_timestamp, props.filters.end_timestamp])

  const spec = useMemo(() => {
    if (loading || error || data.length === 0) {
      return {
        type: 'area',
        data: [{ id: 'channelData', values: [] }],
        xField: 'Time',
        yField: 'Value',
        seriesField: 'Channel',
        stack: false,
        legends: { visible: true, selectMode: 'single' as const },
        title: {
          visible: true,
          text: t('Channel Analytics'),
          subtext: loading ? '' : t('No data available'),
        },
        background: { fill: 'transparent' },
      }
    }

    const yField =
      metric === 'count' ? 'Count' : metric === 'tokens' ? 'Tokens' : 'Quota'

    // Aggregate data by channel_id and time
    const timeChannelMap = new Map<
      string,
      Map<number, { count: number; tokens: number; quota: number }>
    >()
    const allChannelIds = new Set<number>()

    data.forEach((item) => {
      const channelId = item.channel_id ?? 0
      const timestamp = Number(item.created_at)
      const timeKey = formatChartTime(timestamp, timeGranularity)
      const count = Number(item.count) || 0
      const tokens = Number(item.token_used) || 0
      const quota = Number(item.quota) || 0

      allChannelIds.add(channelId)

      if (!timeChannelMap.has(timeKey)) {
        timeChannelMap.set(timeKey, new Map())
      }
      const channelMap = timeChannelMap.get(timeKey)!
      const existing = channelMap.get(channelId) || {
        count: 0,
        tokens: 0,
        quota: 0,
      }
      channelMap.set(channelId, {
        count: existing.count + count,
        tokens: existing.tokens + tokens,
        quota: existing.quota + quota,
      })
    })

    const sortedTimes = Array.from(timeChannelMap.keys()).sort()
    const channelIds = Array.from(allChannelIds).sort((a, b) => a - b)

    // Pad time points if too few
    let chartTimes = sortedTimes
    if (chartTimes.length < MAX_CHART_TREND_POINTS) {
      const lastTime = Math.max(...data.map((item) => Number(item.created_at) || 0))
      const intervalSec =
        timeGranularity === 'week' ? 604800 : timeGranularity === 'day' ? 86400 : 3600
      chartTimes = Array.from({ length: MAX_CHART_TREND_POINTS }, (_, i) =>
        formatChartTime(
          lastTime - (MAX_CHART_TREND_POINTS - 1 - i) * intervalSec,
          timeGranularity
        )
      )
    }

    const channelValues: Array<{
      Time: string
      Channel: string
      Count: number
      Tokens: number
      Quota: number
    }> = []

    chartTimes.forEach((time) => {
      channelIds.forEach((channelId) => {
        const stats = timeChannelMap.get(time)?.get(channelId)
        channelValues.push({
          Time: time,
          Channel: channelLabel(channelId),
          Count: stats?.count ?? 0,
          Tokens: stats?.tokens ?? 0,
          Quota: stats?.quota ?? 0,
        })
      })
    })
    channelValues.sort((a, b) => a.Time.localeCompare(b.Time))

    const colorDomain = channelIds.map((id) => channelLabel(id))
    const colorRange = getDashboardChartColors(colorDomain.length)

    const tooltipContent = [
      {
        key: (datum: Record<string, unknown>) => datum?.Channel,
        value: (datum: Record<string, unknown>) =>
          Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
            Number(datum?.[yField]) || 0
          ),
      },
    ]

    return {
      type: 'area',
      data: [{ id: 'channelData', values: channelValues }],
      xField: 'Time',
      yField,
      seriesField: 'Channel',
      stack: false,
      legends: { visible: true, selectMode: 'single' as const },
      color: {
        type: 'ordinal',
        domain: colorDomain,
        range: colorRange,
      },
      title: {
        visible: true,
        text: t('Channel Analytics'),
      },
      tooltip: {
        mark: {
          content: tooltipContent,
        },
      },
      area: {
        style: {
          fillOpacity: 0.08,
          curveType: 'monotone',
        },
      },
      line: {
        style: {
          lineWidth: 2,
          curveType: 'monotone',
        },
      },
      point: { visible: false },
      background: { fill: 'transparent' },
      animation: true,
    }
  }, [data, loading, error, metric, timeGranularity, t, resolvedTheme])

  const chartKey = [
    metric,
    loading ? 'loading' : 'ready',
    data.length,
    resolvedTheme,
    customization.preset,
  ].join('-')

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <IconBadge tone='chart-4' size='sm'>
            <ArrowLeftRight />
          </IconBadge>
          <div className='text-sm font-semibold'>
            {t('Channel Analytics')}
          </div>
        </div>

        <div className='bg-muted/60 inline-flex h-7 w-full overflow-x-auto rounded-lg border p-0.5 sm:h-8 sm:w-auto'>
          {CHANNEL_METRIC_OPTIONS.map((option) => (
            <button
              key={option.value}
              type='button'
              onClick={() => setMetric(option.value)}
              className={`shrink-0 rounded-md px-3 text-xs font-medium transition-colors ${
                metric === option.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
        {themeReady && (
          <VChart
            key={chartKey}
            spec={{
              ...spec,
              theme: resolvedTheme === 'dark' ? 'dark' : 'light',
              background: 'transparent',
            }}
            option={VCHART_OPTION}
          />
        )}
      </div>
    </div>
  )
}
