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
import { Gauge, HeartPulse, Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import type { PerfModelSummary } from '@/features/performance-metrics/types'

const PERFORMANCE_WINDOW_HOURS = 24
const TOP_MODEL_LIMIT = 5

type WeightedMetric = 'avg_latency_ms' | 'avg_tps' | 'success_rate'

function simpleAverage(
  rows: PerfModelSummary[],
  metric: WeightedMetric,
  isValid: (value: number) => boolean
): number {
  let total = 0
  let count = 0
  for (const row of rows) {
    const value = Number(row[metric])
    if (!isValid(value)) continue
    total += value
    count++
  }
  return count > 0 ? total / count : NaN
}

function rateTextClass(rate: number): string {
  if (!Number.isFinite(rate)) return 'text-muted-foreground'
  if (rate >= 99.9) return 'text-success'
  if (rate >= 99) return 'text-warning'
  return 'text-destructive'
}

function rateDotClass(rate: number): string {
  if (!Number.isFinite(rate)) return 'bg-muted-foreground'
  if (rate >= 99.9) return 'bg-success'
  if (rate >= 99) return 'bg-warning'
  return 'bg-destructive'
}

interface PerformanceHealthPanelProps {
  variant?: 'default' | 'cockpit-ranking'
}

export function PerformanceHealthPanel(props: PerformanceHealthPanelProps) {
  const { t } = useTranslation()
  const isCockpit = props.variant === 'cockpit-ranking'
  const metricsQuery = useQuery({
    queryKey: ['perf-metrics-summary', PERFORMANCE_WINDOW_HOURS],
    queryFn: () => getPerfMetricsSummary(PERFORMANCE_WINDOW_HOURS),
    staleTime: 60 * 1000,
    retry: false,
    ...opsLiveDataQueryOptions,
  })

  const models = useMemo(
    () => metricsQuery.data?.data.models ?? [],
    [metricsQuery.data]
  )

  const summary = useMemo(() => {
    return {
      avgLatencyMs: Math.round(
        simpleAverage(models, 'avg_latency_ms', (v) => Number.isFinite(v) && v > 0)
      ),
      avgTps: simpleAverage(models, 'avg_tps', (v) => Number.isFinite(v) && v > 0),
      successRate: simpleAverage(models, 'success_rate', Number.isFinite),
    }
  }, [models])

  const topModels = useMemo(() => models.slice(0, TOP_MODEL_LIMIT), [models])
  const loading = metricsQuery.isLoading
  const hasData = models.length > 0

  return (
    <section
      className={cn(
        'h-full min-h-[18rem] overflow-hidden rounded-2xl border shadow-xs',
        isCockpit
          ? 'border-violet-500/20 bg-slate-900/60 backdrop-blur-sm'
          : 'bg-card'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 border-b px-4 py-3 sm:px-5',
          isCockpit && 'border-white/10'
        )}
      >
        <HeartPulse
          className={cn(
            'size-4 shrink-0',
            isCockpit ? 'text-violet-400' : 'text-muted-foreground/60'
          )}
          aria-hidden='true'
        />
        <h3
          className={cn('text-sm font-semibold', isCockpit && 'text-slate-100')}
        >
          {isCockpit
            ? t('Dashboard chart model ranking')
            : t('Performance health')}
        </h3>
        <span
          className={cn(
            'ml-auto text-xs',
            isCockpit ? 'text-slate-400' : 'text-muted-foreground'
          )}
        >
          {t('Dashboard KPI perf 24h')}
        </span>
      </div>

      <div className='space-y-3 p-4 sm:p-5'>
        {!isCockpit && (
          <div className='grid grid-cols-3 gap-2'>
            <MetricCell
              icon={HeartPulse}
              label={t('Success rate')}
              value={formatUptimePct(summary.successRate)}
              loading={loading}
              valueClassName={rateTextClass(summary.successRate)}
            />
            <MetricCell
              icon={Timer}
              label={t('Average latency')}
              value={formatLatency(summary.avgLatencyMs)}
              loading={loading}
            />
            <MetricCell
              icon={Gauge}
              label={t('Throughput')}
              value={formatThroughput(summary.avgTps)}
              loading={loading}
            />
          </div>
        )}

        {loading ? (
          <div className='space-y-1'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  'h-5 w-full rounded',
                  isCockpit && 'bg-slate-800'
                )}
              />
            ))}
          </div>
        ) : hasData ? (
          <div>
            {!isCockpit && (
              <span className='text-muted-foreground mb-1 block text-[11px] font-medium'>
                {t('Top models by traffic')}
              </span>
            )}
            <div className='grid grid-cols-1 gap-x-4 sm:grid-cols-2'>
              {topModels.map((model) => (
                <div
                  key={model.model_name}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded px-1.5 py-1',
                    isCockpit && 'border border-white/5 bg-slate-950/40'
                  )}
                >
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate font-mono text-[11px]',
                      isCockpit && 'text-slate-300'
                    )}
                  >
                    {model.model_name}
                  </span>
                  <span className='inline-flex shrink-0 items-center gap-1'>
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        rateDotClass(model.success_rate)
                      )}
                      aria-hidden='true'
                    />
                    <span
                      className={cn(
                        'font-mono text-[11px] font-semibold tabular-nums',
                        rateTextClass(model.success_rate)
                      )}
                    >
                      {formatUptimePct(model.success_rate)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p
            className={cn(
              'text-xs',
              isCockpit ? 'text-slate-500' : 'text-muted-foreground'
            )}
          >
            {t('No data available')}
          </p>
        )}
      </div>
    </section>
  )
}

function MetricCell(props: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  loading: boolean
  valueClassName?: string
}) {
  const Icon = props.icon
  return (
    <div className='bg-muted/40 rounded-xl px-3 py-2.5'>
      <div className='text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium'>
        <Icon className='size-3 shrink-0' aria-hidden='true' />
        <span className='truncate'>{props.label}</span>
      </div>
      {props.loading ? (
        <Skeleton className='mt-1.5 h-5 w-16' />
      ) : (
        <div
          className={cn(
            'mt-1.5 font-mono text-sm font-semibold tabular-nums',
            props.valueClassName
          )}
        >
          {props.value}
        </div>
      )}
    </div>
  )
}
