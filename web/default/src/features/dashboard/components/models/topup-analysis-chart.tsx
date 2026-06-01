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
import { useEffect, useMemo, useRef, useState } from 'react'
import { VChart } from '@visactor/react-vchart'
import { BadgeDollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatLocalCurrencyAmount } from '@/lib/currency'
import { useThemeRadiusPx } from '@/lib/theme-radius'
import {
  computeTimeRange,
  formatChartTime,
  type TimeGranularity,
} from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import { getTopUpAnalysisData } from '@/features/dashboard/api'
import { buildQueryParams, getDefaultDays } from '@/features/dashboard/lib'
import { DEFAULT_TIME_GRANULARITY } from '@/features/dashboard/constants'
import type {
  DashboardFilters,
  TopUpAnalysisItem,
} from '@/features/dashboard/types'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

interface TopUpAnalysisChartProps {
  filters: DashboardFilters
  timeGranularity?: TimeGranularity
}

type TopUpPoint = {
  Time: string
  Channel: string
  Money: number
  Count: number
  rawMoney: number
}

function getChannelLabel(item: TopUpAnalysisItem): string {
  const provider = item.payment_provider?.trim() || ''
  const method = item.payment_method?.trim() || ''
  if (provider && method && provider !== method) {
    return `${provider}/${method}`
  }
  return provider || method || 'Unknown'
}

export function TopUpAnalysisChart(props: TopUpAnalysisChartProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
  const chartRadius = useThemeRadiusPx(
    '--radius-md',
    `${customization.preset}:${customization.radius}`
  )
  const [data, setData] = useState<TopUpAnalysisItem[]>([])
  const [loading, setLoading] = useState(true)
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)
  const timeGranularity = props.timeGranularity ?? DEFAULT_TIME_GRANULARITY

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
    setLoading(true)

    const timeRange = computeTimeRange(
      getDefaultDays(props.filters.time_granularity),
      props.filters.start_timestamp,
      props.filters.end_timestamp
    )

    getTopUpAnalysisData(buildQueryParams(timeRange, props.filters))
      .then((res) => {
        if (abortController.signal.aborted) return
        setData(res?.data || [])
      })
      .catch(() => {
        if (abortController.signal.aborted) return
        setData([])
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [props.filters])

  const chartData = useMemo(() => {
    const timeChannelMap = new Map<
      string,
      Map<string, { money: number; count: number }>
    >()
    const channelTotals = new Map<string, number>()

    for (const item of data) {
      const timeKey = formatChartTime(
        Number(item.created_at) || 0,
        timeGranularity
      )
      const channel = getChannelLabel(item)
      const money = Number(item.money) || 0
      const count = Number(item.count) || 0

      if (!timeChannelMap.has(timeKey)) {
        timeChannelMap.set(timeKey, new Map())
      }
      const channelMap = timeChannelMap.get(timeKey)!
      const prev = channelMap.get(channel) || { money: 0, count: 0 }
      channelMap.set(channel, {
        money: prev.money + money,
        count: prev.count + count,
      })

      channelTotals.set(channel, (channelTotals.get(channel) || 0) + money)
    }

    const sortedTimes = Array.from(timeChannelMap.keys()).sort()
    const sortedChannels = Array.from(channelTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([channel]) => channel)

    const points: TopUpPoint[] = []
    for (const time of sortedTimes) {
      const timeMap = timeChannelMap.get(time)
      for (const channel of sortedChannels) {
        const stats = timeMap?.get(channel)
        const money = Number(stats?.money) || 0
        const count = Number(stats?.count) || 0
        points.push({
          Time: time,
          Channel: channel,
          Money: money,
          Count: count,
          rawMoney: money,
        })
      }
    }

    return {
      points,
      totalMoney: Array.from(channelTotals.values()).reduce(
        (sum, value) => sum + value,
        0
      ),
      totalCount: data.reduce(
        (sum, item) => sum + (Number(item.count) || 0),
        0
      ),
    }
  }, [data, timeGranularity])

  const chartKey = [
    'topup',
    loading ? 'fetching' : 'loaded',
    chartData.points.length,
    resolvedTheme,
    customization.preset,
  ].join('-')

  const spec = {
    type: 'bar',
    data: [{ id: 'topupData', values: chartData.points }],
    xField: 'Time',
    yField: 'Money',
    seriesField: 'Channel',
    stack: true,
    legends: { visible: true, selectMode: 'single' },
    title: {
      visible: true,
      text: t('Top-up Amount Trend'),
    },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum: Record<string, unknown>) => datum?.Channel,
            value: (datum: Record<string, unknown>) =>
              formatLocalCurrencyAmount(Number(datum?.rawMoney) || 0),
          },
        ],
      },
      dimension: {
        content: [
          {
            key: (datum: Record<string, unknown>) => datum?.Channel,
            value: (datum: Record<string, unknown>) =>
              Number(datum?.rawMoney) || 0,
          },
        ],
        updateContent: (
          array: Array<{ key: string; value: string | number }>
        ) => {
          const total = array.reduce(
            (sum, item) => sum + (Number(item.value) || 0),
            0
          )
          array.forEach((item) => {
            item.value = formatLocalCurrencyAmount(Number(item.value) || 0)
          })
          array.unshift({
            key: t('Total:'),
            value: formatLocalCurrencyAmount(total),
          })
          return array
        },
      },
    },
    background: { fill: 'transparent' },
    animation: true,
    bar: {
      style: {
        cornerRadius: chartRadius,
      },
    },
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <BadgeDollarSign className='text-muted-foreground/60 size-4' />
          <div className='text-sm font-semibold'>{t('Top-up Analytics')}</div>
          <span className='text-muted-foreground text-xs'>
            {t('Total:')} {formatLocalCurrencyAmount(chartData.totalMoney)}
          </span>
        </div>
        <span className='text-muted-foreground text-xs'>
          {t('Total Count')}: {chartData.totalCount.toLocaleString()}
        </span>
      </div>

      <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
        {themeReady && !loading && (
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
