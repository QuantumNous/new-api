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
import { Gauge, HeartPulse, Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getPerfMetrics,
  getPerfMetricsSummary,
} from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
  getSuccessRateDotClass,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import type {
  PerformanceGroup,
  PerfModelSummary,
} from '@/features/performance-metrics/types'
import { cn } from '@/lib/utils'

const PERFORMANCE_WINDOW_HOURS = 24
const TOP_MODEL_LIMIT = 6

type PerformanceMetric = 'avg_latency_ms' | 'avg_tps' | 'success_rate'

type PerformanceSummary = {
  avgLatencyMs: number
  avgTps: number
  successRate: number
}

function simpleAverage(
  rows: PerfModelSummary[],
  metric: PerformanceMetric,
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

  return count > 0 ? total / count : Number.NaN
}

function buildPerformanceSummary(rows: PerfModelSummary[]): PerformanceSummary {
  return {
    avgLatencyMs: Math.round(
      simpleAverage(
        rows,
        'avg_latency_ms',
        (value) => Number.isFinite(value) && value > 0
      )
    ),
    avgTps: simpleAverage(
      rows,
      'avg_tps',
      (value) => Number.isFinite(value) && value > 0
    ),
    successRate: simpleAverage(rows, 'success_rate', Number.isFinite),
  }
}

export function PerformanceOverview() {
  const { t } = useTranslation()
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const metricsQuery = useQuery({
    queryKey: ['perf-metrics-summary', PERFORMANCE_WINDOW_HOURS],
    queryFn: () => getPerfMetricsSummary(PERFORMANCE_WINDOW_HOURS),
    staleTime: 60 * 1000,
    retry: false,
  })

  const models = useMemo(
    () => metricsQuery.data?.data.models ?? [],
    [metricsQuery.data]
  )
  const summary = useMemo(() => buildPerformanceSummary(models), [models])
  const reportedModels = useMemo(
    () => models.slice(0, TOP_MODEL_LIMIT),
    [models]
  )
  const loading = metricsQuery.isLoading
  const hasData = models.length > 0

  useEffect(() => {
    if (selectedModel || reportedModels.length === 0) return
    setSelectedModel(reportedModels[0].model_name)
  }, [reportedModels, selectedModel])

  useEffect(() => {
    if (!selectedModel) return
    if (!models.some((model) => model.model_name === selectedModel)) {
      setSelectedModel(reportedModels[0]?.model_name ?? null)
    }
  }, [models, reportedModels, selectedModel])

  const selectedModelName = selectedModel ?? ''
  const selectedMetricsQuery = useQuery({
    queryKey: ['perf-metrics', selectedModelName, PERFORMANCE_WINDOW_HOURS],
    queryFn: () => getPerfMetrics(selectedModelName, PERFORMANCE_WINDOW_HOURS),
    enabled: selectedModelName.length > 0,
    staleTime: 60 * 1000,
    retry: false,
  })

  if (!loading && !hasData) {
    return (
      <div className='text-muted-foreground overflow-hidden rounded-lg border px-4 py-3 text-center text-xs'>
        {t('No performance data available')}
      </div>
    )
  }

  return (
    <section
      className='overflow-hidden rounded-lg border'
      aria-label={t('Performance health')}
    >
      <div className='flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b px-4 py-2.5 sm:px-5 sm:py-3'>
        <div className='flex items-center gap-1.5'>
          <IconBadge tone='success' size='xs'>
            <HeartPulse />
          </IconBadge>
          <span className='text-xs font-semibold whitespace-nowrap'>
            {t('Performance health')}
          </span>
        </div>

        <div className='bg-border hidden h-4 w-px sm:block' />

        {loading ? (
          <div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
            {['success', 'latency', 'throughput'].map((key) => (
              <div key={key} className='flex items-center gap-1.5'>
                <Skeleton className='h-3 w-14' />
                <Skeleton className='h-4 w-16' />
              </div>
            ))}
          </div>
        ) : (
          <div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
            <InlineMetric
              icon={HeartPulse}
              label={t('Success rate')}
              value={formatUptimePct(summary.successRate)}
              valueClassName={getSuccessRateTextClass(summary.successRate)}
              tone='success'
            />
            <InlineMetric
              icon={Timer}
              label={t('Average latency')}
              value={formatLatency(summary.avgLatencyMs)}
              tone='warning'
            />
            <InlineMetric
              icon={Gauge}
              label={t('Throughput')}
              value={formatThroughput(summary.avgTps)}
              tone='info'
            />
          </div>
        )}

        <span className='text-muted-foreground text-[11px] sm:ml-auto'>
          {t('Reported-model averages · last 24 hours')}
        </span>
      </div>

      {!loading && hasData && (
        <div className='space-y-3 p-4 sm:p-5'>
          <div>
            <div className='mb-1.5 flex flex-wrap items-center justify-between gap-1.5'>
              <div>
                <p className='text-sm font-semibold'>
                  {t('Model diagnostics')}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'Select a model to inspect its reported group performance.'
                  )}
                </p>
              </div>
              <span className='text-muted-foreground text-[11px]'>
                {t('Last 24 hours')}
              </span>
            </div>
            <div
              className='flex max-w-full gap-1.5 overflow-x-auto pb-1'
              role='list'
            >
              {reportedModels.map((model) => (
                <ModelButton
                  key={model.model_name}
                  model={model}
                  selected={model.model_name === selectedModel}
                  onSelect={setSelectedModel}
                />
              ))}
            </div>
          </div>

          {selectedModel && (
            <PerformanceDetail
              modelName={selectedModel}
              groups={selectedMetricsQuery.data?.data.groups ?? []}
              isLoading={selectedMetricsQuery.isLoading}
              isError={selectedMetricsQuery.isError}
              onRetry={() => void selectedMetricsQuery.refetch()}
            />
          )}
        </div>
      )}
    </section>
  )
}

function InlineMetric(props: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  valueClassName?: string
  tone: IconBadgeTone
}) {
  const Icon = props.icon

  return (
    <div className='flex items-center gap-1.5'>
      <IconBadge tone={props.tone} size='xs'>
        <Icon />
      </IconBadge>
      <span className='text-muted-foreground text-[11px]'>{props.label}</span>
      <span
        className={cn(
          'font-mono text-xs font-semibold tabular-nums',
          props.valueClassName
        )}
      >
        {props.value}
      </span>
    </div>
  )
}

function ModelButton(props: {
  model: PerfModelSummary
  selected: boolean
  onSelect: (modelName: string) => void
}) {
  const { t } = useTranslation()
  const { model } = props

  return (
    <button
      type='button'
      className={cn(
        'bg-muted/50 hover:bg-muted focus-visible:ring-ring inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-start transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        props.selected &&
          'bg-primary text-primary-foreground hover:bg-primary/90'
      )}
      aria-pressed={props.selected}
      title={model.model_name}
      aria-label={t('Inspect {{model}} performance', {
        model: model.model_name,
      })}
      onClick={() => props.onSelect(model.model_name)}
    >
      <span className='max-w-[10rem] truncate font-mono text-[11px]'>
        {model.model_name}
      </span>
      <span
        className={cn(
          'size-1.5 rounded-full',
          props.selected
            ? 'bg-primary-foreground/80'
            : getSuccessRateDotClass(model.success_rate)
        )}
        aria-hidden='true'
      />
      <span
        className={cn(
          'font-mono text-[11px] font-semibold tabular-nums',
          props.selected
            ? 'text-primary-foreground'
            : getSuccessRateTextClass(model.success_rate)
        )}
      >
        {formatUptimePct(model.success_rate)}
      </span>
    </button>
  )
}

function PerformanceDetail(props: {
  modelName: string
  groups: PerformanceGroup[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation()

  let content: React.ReactNode
  if (props.isLoading) {
    content = (
      <div className='space-y-2 p-3 sm:p-4'>
        {['group-1', 'group-2', 'group-3'].map((key) => (
          <Skeleton key={key} className='h-11 w-full' />
        ))}
      </div>
    )
  } else if (props.isError) {
    content = (
      <div className='flex flex-col items-center gap-2 p-5 text-center'>
        <p className='text-muted-foreground text-sm'>
          {t('Failed to load performance details')}
        </p>
        <button
          type='button'
          className='text-primary text-sm font-medium underline underline-offset-4'
          onClick={props.onRetry}
        >
          {t('Retry')}
        </button>
      </div>
    )
  } else if (props.groups.length === 0) {
    content = (
      <p className='text-muted-foreground p-5 text-center text-sm'>
        {t('Performance data is not yet available for this model.')}
      </p>
    )
  } else {
    content = (
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[44rem] text-sm'>
          <thead className='bg-muted/35 text-muted-foreground text-xs'>
            <tr>
              <th className='px-3 py-2 text-left font-medium sm:px-4'>
                {t('Group')}
              </th>
              <th className='px-3 py-2 text-right font-medium'>
                {t('Average TTFT')}
              </th>
              <th className='px-3 py-2 text-right font-medium'>
                {t('Average latency')}
              </th>
              <th className='px-3 py-2 text-right font-medium'>TPS</th>
              <th className='px-3 py-2 text-right font-medium sm:px-4'>
                {t('Success rate')}
              </th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {props.groups.map((group) => (
              <tr key={group.group} className='hover:bg-muted/25'>
                <td className='px-3 py-2.5 font-medium sm:px-4'>
                  {group.group}
                </td>
                <td className='px-3 py-2.5 text-right font-mono text-xs tabular-nums'>
                  {formatLatency(group.avg_ttft_ms)}
                </td>
                <td className='px-3 py-2.5 text-right font-mono text-xs tabular-nums'>
                  {formatLatency(group.avg_latency_ms)}
                </td>
                <td className='px-3 py-2.5 text-right font-mono text-xs tabular-nums'>
                  {formatThroughput(group.avg_tps)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2.5 text-right font-mono text-xs font-semibold tabular-nums sm:px-4',
                    getSuccessRateTextClass(group.success_rate)
                  )}
                >
                  {formatUptimePct(group.success_rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className='rounded-lg border'>
      <div className='flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4'>
        <div className='min-w-0'>
          <p className='text-sm font-semibold'>{t('Per-group performance')}</p>
          <p
            className='text-muted-foreground truncate font-mono text-xs'
            title={props.modelName}
          >
            {props.modelName}
          </p>
        </div>
        <span className='text-muted-foreground text-xs'>
          {t('Average TTFT, latency, throughput, and success rate')}
        </span>
      </div>
      {content}
    </div>
  )
}
