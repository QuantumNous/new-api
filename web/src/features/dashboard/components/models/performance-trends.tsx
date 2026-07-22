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
import { useQueries, useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import { Clock, Gauge, Timer, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import {
  getPerfMetrics,
  getPerfMetricsSummary,
} from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
} from '@/features/performance-metrics/lib/format'
import type { PerformanceMetricsData } from '@/features/performance-metrics/types'
import { getDashboardChartColors } from '@/features/dashboard/lib/charts'
import { VCHART_OPTION } from '@/lib/vchart'
import { cn } from '@/lib/utils'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

type PerformanceTrendMetric = 'throughput' | 'latency' | 'ttft'

const TREND_METRIC_OPTIONS: {
  value: PerformanceTrendMetric
  labelKey: string
  icon: typeof TrendingUp
}[] = [
  { value: 'throughput', labelKey: 'Throughput', icon: Gauge },
  { value: 'latency', labelKey: 'Latency', icon: Timer },
  { value: 'ttft', labelKey: 'TTFT', icon: Clock },
]

const TREND_WINDOW_HOURS = 720 // 30 days
const TOP_MODELS_LIMIT = 6

function getMetricAccessor(
  metric: PerformanceTrendMetric
): 'avg_tps' | 'avg_latency_ms' | 'avg_ttft_ms' {
  if (metric === 'throughput') return 'avg_tps'
  if (metric === 'latency') return 'avg_latency_ms'
  return 'avg_ttft_ms'
}

function formatTrendValue(metric: PerformanceTrendMetric, value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (metric === 'throughput') return formatThroughput(value)
  if (metric === 'latency') return formatLatency(value)
  return formatLatency(value) // TTFT also in ms
}

export function PerformanceTrends() {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)
  const [metric, setMetric] = useState<PerformanceTrendMetric>('throughput')

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

  const summaryQuery = useQuery({
    queryKey: ['perf-metrics-summary', 24],
    queryFn: () => getPerfMetricsSummary(24),
    staleTime: 60 * 1000,
  })

  const topModels = useMemo(() => {
    if (!summaryQuery.data) return []
    return summaryQuery.data.data.models
      .filter((m) => m.avg_tps > 0)
      .slice(0, TOP_MODELS_LIMIT)
      .map((m) => m.model_name)
  }, [summaryQuery.data])

  const seriesQueries = useQueries({
    queries: topModels.map((model) => ({
      queryKey: ['perf-metrics', model, TREND_WINDOW_HOURS],
      queryFn: () => getPerfMetrics(model, TREND_WINDOW_HOURS),
      enabled: topModels.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
    combine: (results) => {
      const data: PerformanceMetricsData[] = []
      let isLoading = topModels.length > 0
      for (const result of results) {
        if (result.isSuccess && result.data) {
          data.push(result.data)
        }
        if (!result.isLoading) {
          // At least one query finished
        }
      }
      if (results.every((r) => !r.isLoading)) {
        isLoading = false
      }
      return { data, isLoading }
    },
  })

  const loading = summaryQuery.isLoading || seriesQueries.isLoading

  const chartKey = [
    metric,
    loading ? 'loading' : 'ready',
    topModels.length,
    resolvedTheme,
    customization.preset,
  ].join('-')

  const spec = useMemo(() => {
    if (loading || topModels.length === 0) {
      return {
        type: 'line',
        data: [{ id: 'trendData', values: [] }],
        xField: 'Time',
        yField: 'Value',
        seriesField: 'Model',
        title: {
          visible: true,
          text: t('Performance Trends'),
          subtext: loading ? '' : t('No data available'),
        },
        legends: { visible: false },
        background: { fill: 'transparent' },
      }
    }

    const accessor = getMetricAccessor(metric)
    const allValues: Array<{
      Time: number
      Model: string
      Value: number
    }> = []

    for (const perfData of seriesQueries.data) {
      const modelName = perfData.data.model_name
      for (const group of perfData.data.groups) {
        for (const point of group.series) {
          allValues.push({
            Time: point.ts,
            Model: modelName,
            Value: point[accessor],
          })
        }
      }
    }

    allValues.sort((a, b) => a.Time - b.Time)

    const colors = getDashboardChartColors(topModels.length)
    const colorSpecified = Object.fromEntries(
      topModels.map((model, i) => [model, colors[i]])
    )

    return {
      type: 'line',
      data: [{ id: 'trendData', values: allValues }],
      xField: 'Time',
      yField: 'Value',
      seriesField: 'Model',
      title: {
        visible: true,
        text: t('Performance Trends'),
        subtext: t('30-day'),
      },
      legends: { visible: true, selectMode: 'single' as const },
      color: {
        specified: colorSpecified,
      },
      axes: [
        {
          orient: 'bottom',
          type: 'linear',
          label: {
            formatMethod: (value: number) => {
              const date = new Date(value * 1000)
              return `${date.getMonth() + 1}/${date.getDate()}`
            },
            style: { fontSize: 11 },
          },
        },
        {
          orient: 'left',
          type: 'linear',
          label: {
            formatMethod: (value: number) => formatTrendValue(metric, value),
            style: { fontSize: 11 },
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.Model,
              value: (datum: Record<string, unknown>) =>
                formatTrendValue(metric, Number(datum?.Value) || 0),
            },
          ],
        },
      },
      line: {
        style: {
          lineWidth: 2,
          curveType: 'monotone',
        },
      },
      point: {
        visible: false,
      },
      background: { fill: 'transparent' },
      animation: true,
    }
  }, [metric, seriesQueries.data, topModels, loading, t])

  if (loading) {
    return (
      <div className='overflow-hidden rounded-lg border'>
        <div className='border-b px-4 py-3 sm:px-5'>
          <Skeleton className='h-5 w-32' />
          <Skeleton className='mt-1 h-3 w-24' />
        </div>
        <div className='h-[340px] p-2'>
          <Skeleton className='h-full w-full' />
        </div>
      </div>
    )
  }

  if (topModels.length === 0) {
    return (
      <div className='text-muted-foreground overflow-hidden rounded-lg border px-4 py-3 text-center text-xs'>
        {t('No trend data available')}
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <div className='flex items-center gap-2'>
            <IconBadge tone='chart-4' size='sm'>
              <TrendingUp />
            </IconBadge>
            <span className='text-sm font-semibold'>
              {t('Performance Trends')}
            </span>
          </div>
          <p className='text-muted-foreground mt-0.5 text-xs'>
            {t('30-day')}
          </p>
        </div>

        <div className='bg-muted/60 inline-flex h-7 w-full overflow-x-auto rounded-lg border p-0.5 sm:h-8 sm:w-auto'>
          {TREND_METRIC_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.value}
                type='button'
                onClick={() => setMetric(option.value)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
                  metric === option.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className='size-3.5' />
                {t(option.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      <div className='h-[340px] p-1.5 sm:h-96 sm:p-2'>
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
