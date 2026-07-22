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
import { Gauge } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import { formatThroughput } from '@/features/performance-metrics/lib/format'
import type { PerfModelSummary } from '@/features/performance-metrics/types'
import { VCHART_OPTION } from '@/lib/vchart'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

const PERFORMANCE_WINDOW_HOURS = 24
const RANK_MODEL_LIMIT = 10

type ConfidenceLevel = 'high' | 'medium' | 'low'

function getConfidenceLevel(model: PerfModelSummary): ConfidenceLevel {
  const count = model.request_count ?? 0
  if (count > 100) return 'high'
  if (count > 20) return 'medium'
  return 'low'
}

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: '#10b981',
  medium: '#f59e0b',
  low: '#9ca3af',
}

const CONFIDENCE_LABEL_KEYS: Record<ConfidenceLevel, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function PerformanceRanking() {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)
  const [models, setModels] = useState<PerfModelSummary[]>([])
  const [loading, setLoading] = useState(true)

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

    void getPerfMetricsSummary(PERFORMANCE_WINDOW_HOURS)
      .then((res) => {
        if (abortController.signal.aborted) return
        const data = res?.data?.models ?? []
        setModels(data.filter((m) => m.avg_tps > 0).slice(0, RANK_MODEL_LIMIT))
      })
      .catch(() => {
        if (abortController.signal.aborted) return
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [])

  const spec = useMemo(() => {
    if (loading || models.length === 0) {
      return {
        type: 'bar',
        data: [{ id: 'rankData', values: [] }],
        xField: 'tps',
        yField: 'model',
        seriesField: 'model',
        direction: 'horizontal',
        title: {
          visible: true,
          text: t('Fastest Models'),
          subtext: loading ? '' : t('No data available'),
        },
        legends: { visible: false },
        background: { fill: 'transparent' },
      }
    }

    const sorted = [...models].sort((a, b) => b.avg_tps - a.avg_tps)
    const values = sorted.map((m) => ({
      model: m.model_name,
      tps: m.avg_tps,
      confidence: getConfidenceLevel(m),
      requestCount: m.request_count ?? 0,
      avgLatencyMs: m.avg_latency_ms,
    }))

    const colors = sorted.map((m) => CONFIDENCE_COLORS[getConfidenceLevel(m)])

    return {
      type: 'bar',
      data: [{ id: 'rankData', values }],
      xField: 'tps',
      yField: 'model',
      seriesField: 'model',
      direction: 'horizontal',
      title: {
        visible: true,
        text: t('Fastest Models'),
        subtext: t('By throughput (tokens/s)'),
      },
      legends: { visible: false },
      bar: {
        state: { hover: { stroke: '#000', lineWidth: 1 } },
      },
      color: {
        type: 'ordinal',
        specified: Object.fromEntries(
          sorted.map((m, i) => [m.model_name, colors[i]])
        ),
      },
      axes: [
        {
          orient: 'left',
          type: 'band',
          label: {
            style: { fontSize: 12 },
          },
        },
        {
          orient: 'bottom',
          type: 'linear',
          label: {
            formatMethod: (value: number) => formatThroughput(value),
            style: { fontSize: 11 },
          },
        },
      ],
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.model,
              value: (datum: Record<string, unknown>) =>
                formatThroughput(Number(datum?.tps) || 0),
            },
          ],
        },
      },
      background: { fill: 'transparent' },
      animation: true,
    }
  }, [models, loading, t, resolvedTheme])

  const chartKey = [
    loading ? 'loading' : 'ready',
    models.length,
    resolvedTheme,
    customization.preset,
  ].join('-')

  if (loading) {
    return (
      <div className='overflow-hidden rounded-lg border'>
        <div className='border-b px-4 py-3 sm:px-5'>
          <div className='flex items-center gap-2'>
            <Skeleton className='h-4 w-24' />
          </div>
          <Skeleton className='mt-1 h-3 w-36' />
        </div>
        <div className='h-[340px] p-2'>
          <Skeleton className='h-full w-full' />
        </div>
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex items-center justify-between border-b px-4 py-3 sm:px-5'>
        <div>
          <div className='flex items-center gap-2'>
            <IconBadge tone='info' size='xs'>
              <Gauge />
            </IconBadge>
            <span className='text-sm font-semibold'>{t('Fastest Models')}</span>
          </div>
          <p className='text-muted-foreground mt-0.5 text-xs'>
            {t('By throughput (tokens/s)')}
          </p>
        </div>

        <div className='flex items-center gap-3'>
          {(['high', 'medium', 'low'] as ConfidenceLevel[]).map((level) => (
            <div key={level} className='flex items-center gap-1.5'>
              <span
                className='size-2 rounded-full'
                style={{ backgroundColor: CONFIDENCE_COLORS[level] }}
                aria-hidden='true'
              />
              <span className='text-muted-foreground text-[11px]'>
                {t(CONFIDENCE_LABEL_KEYS[level])}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className='h-[340px] p-2'>
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
