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
import { Activity, Gauge, HeartPulse, Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import type { PerfModelSummary } from '@/features/performance-metrics/types'

const PERFORMANCE_WINDOW_HOURS = 24
const TOP_MODEL_LIMIT = 8

type WeightedMetric = 'avg_latency_ms' | 'avg_tps' | 'success_rate'

type PerformanceSummary = {
  totalRequests: number
  avgLatencyMs: number
  avgTps: number
  successRate: number
}

function weightedAverage(
  rows: PerfModelSummary[],
  metric: WeightedMetric,
  isValid: (value: number) => boolean
): number {
  let total = 0
  let weight = 0

  for (const row of rows) {
    const value = Number(row[metric])
    const requestCount = Number(row.request_count) || 0
    if (requestCount <= 0 || !isValid(value)) continue

    total += value * requestCount
    weight += requestCount
  }

  return weight > 0 ? total / weight : 0
}

function buildPerformanceSummary(rows: PerfModelSummary[]): PerformanceSummary {
  const totalRequests = rows.reduce(
    (sum, row) => sum + (Number(row.request_count) || 0),
    0
  )

  return {
    totalRequests,
    avgLatencyMs: Math.round(
      weightedAverage(
        rows,
        'avg_latency_ms',
        (value) => Number.isFinite(value) && value > 0
      )
    ),
    avgTps: weightedAverage(
      rows,
      'avg_tps',
      (value) => Number.isFinite(value) && value > 0
    ),
    successRate: weightedAverage(rows, 'success_rate', Number.isFinite),
  }
}

function successRateClassName(successRate: number): string {
  if (successRate >= 99.9) return 'text-emerald-600 dark:text-emerald-400'
  if (successRate >= 99) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

function successDotClassName(successRate: number): string {
  if (successRate >= 99.9) return 'bg-emerald-500'
  if (successRate >= 99) return 'bg-amber-500'
  return 'bg-rose-500'
}

function PerformanceMetricItem(props: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint: string
  loading?: boolean
  valueClassName?: string
}) {
  const Icon = props.icon

  return (
    <div className='px-3 py-2.5 sm:px-5 sm:py-4'>
      <div className='flex items-center gap-2'>
        <Icon
          className='text-muted-foreground/60 size-3.5 shrink-0'
          aria-hidden='true'
        />
        <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
          {props.label}
        </div>
      </div>
      {props.loading ? (
        <div className='mt-2 space-y-1.5'>
          <Skeleton className='h-7 w-20' />
          <Skeleton className='h-3.5 w-28' />
        </div>
      ) : (
        <>
          <div
            className={cn(
              'text-foreground mt-1.5 font-mono text-lg font-bold tracking-tight tabular-nums sm:mt-2 sm:text-2xl',
              props.valueClassName
            )}
          >
            {props.value}
          </div>
          <div className='text-muted-foreground/60 mt-1 hidden text-xs md:block'>
            {props.hint}
          </div>
        </>
      )}
    </div>
  )
}

function PerformanceTableHeader(props: { description: string }) {
  const { t } = useTranslation()

  return (
    <div className='flex flex-col gap-1.5 border-b px-3 py-2 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
      <div className='flex items-center gap-2'>
        <Activity className='text-muted-foreground/60 size-4' />
        <div className='text-sm font-semibold'>
          {t('Model performance metrics')}
        </div>
      </div>
      <span className='text-muted-foreground text-xs'>{props.description}</span>
    </div>
  )
}

export function PerformanceOverview() {
  const { t } = useTranslation()
  const metricsQuery = useQuery({
    queryKey: ['perf-metrics-summary', PERFORMANCE_WINDOW_HOURS],
    queryFn: () => getPerfMetricsSummary(PERFORMANCE_WINDOW_HOURS),
    staleTime: 60 * 1000,
    retry: false,
  })

  const models = useMemo(
    () =>
      [...(metricsQuery.data?.data.models ?? [])]
        .filter((model) => Number(model.request_count) > 0)
        .sort((a, b) => b.request_count - a.request_count),
    [metricsQuery.data]
  )
  const summary = useMemo(() => buildPerformanceSummary(models), [models])
  const topModels = useMemo(() => models.slice(0, TOP_MODEL_LIMIT), [models])
  const loading = metricsQuery.isLoading
  const hasData = models.length > 0
  const description = t('Performance metrics for the last 24 hours')

  return (
    <section className='space-y-3 sm:space-y-4'>
      <div className='overflow-hidden rounded-lg border'>
        <div className='divide-border/60 grid grid-cols-2 divide-x sm:grid-cols-4'>
          <PerformanceMetricItem
            icon={Activity}
            label={t('Requests (24h)')}
            value={formatNumber(summary.totalRequests)}
            hint={t('Monitored relay requests')}
            loading={loading}
          />
          <PerformanceMetricItem
            icon={Timer}
            label={t('Average latency')}
            value={formatLatency(summary.avgLatencyMs)}
            hint={t('Weighted by request count')}
            loading={loading}
          />
          <PerformanceMetricItem
            icon={Gauge}
            label={t('Throughput')}
            value={formatThroughput(summary.avgTps)}
            hint='TPS'
            loading={loading}
          />
          <PerformanceMetricItem
            icon={HeartPulse}
            label={t('Success rate')}
            value={formatUptimePct(summary.successRate)}
            hint={t('Weighted by request count')}
            loading={loading}
            valueClassName={successRateClassName(summary.successRate)}
          />
        </div>
      </div>

      <div className='overflow-hidden rounded-lg border'>
        <PerformanceTableHeader description={description} />
        {!loading && !hasData ? (
          <div className='text-muted-foreground p-6 text-center text-sm'>
            {t('No performance data available')}
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <Table className='text-sm'>
              <TableHeader>
                <TableRow className='hover:bg-transparent'>
                  <TableHead>{t('Model')}</TableHead>
                  <TableHead className='text-right'>
                    {t('Requests (24h)')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('Average latency')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('Throughput')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('Success rate')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Skeleton className='h-4 w-40' />
                        </TableCell>
                        <TableCell className='text-right'>
                          <Skeleton className='ml-auto h-4 w-16' />
                        </TableCell>
                        <TableCell className='text-right'>
                          <Skeleton className='ml-auto h-4 w-16' />
                        </TableCell>
                        <TableCell className='text-right'>
                          <Skeleton className='ml-auto h-4 w-16' />
                        </TableCell>
                        <TableCell className='text-right'>
                          <Skeleton className='ml-auto h-4 w-20' />
                        </TableCell>
                      </TableRow>
                    ))
                  : topModels.map((model) => (
                      <TableRow key={model.model_name}>
                        <TableCell className='max-w-[220px] truncate font-mono'>
                          {model.model_name}
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {formatNumber(model.request_count)}
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {formatLatency(model.avg_latency_ms)}
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {formatThroughput(model.avg_tps)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono font-semibold tabular-nums',
                            successRateClassName(model.success_rate)
                          )}
                        >
                          <span className='inline-flex items-center justify-end gap-1.5'>
                            <span
                              className={cn(
                                'size-2 rounded-full',
                                successDotClassName(model.success_rate)
                              )}
                              aria-hidden='true'
                            />
                            {formatUptimePct(model.success_rate)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </section>
  )
}
