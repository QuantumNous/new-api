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
import { AlertTriangle, HeartPulse, Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GroupBadge } from '@/components/group-badge'
import { getPerfMetrics } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import type { PerformanceGroup } from '@/features/performance-metrics/types'
import { type UptimeDayPoint } from '../lib/mock-stats'
import type { PricingModel } from '../types'
import { LatencyTrendChart, UptimeTrendChart } from './model-details-charts'
import { UptimeSparkline } from './model-details-uptime-sparkline'

function StatCard(props: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  hint?: string
  intent?: 'default' | 'warning' | 'success'
}) {
  const Icon = props.icon
  const intent = props.intent ?? 'default'
  return (
    <div className='bg-background flex flex-col gap-1 rounded-lg border p-3'>
      <span className='text-muted-foreground inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase'>
        <Icon className='size-3' />
        {props.label}
      </span>
      <span
        className={cn(
          'text-foreground font-mono text-lg font-semibold tabular-nums',
          intent === 'warning' && 'text-amber-600 dark:text-amber-400',
          intent === 'success' && 'text-emerald-600 dark:text-emerald-400'
        )}
      >
        {props.value}
      </span>
      {props.hint && (
        <span className='text-muted-foreground/70 text-[11px]'>
          {props.hint}
        </span>
      )}
    </div>
  )
}

type PerformanceRow = {
  group: string
  avg_ttft_ms: number
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
}

function toLatencySeries(groups: PerformanceGroup[]) {
  const byTs = new Map<number, number[]>()
  for (const group of groups) {
    for (const point of group.series) {
      if (point.avg_ttft_ms <= 0) continue
      const current = byTs.get(point.ts) ?? []
      current.push(point.avg_ttft_ms)
      byTs.set(point.ts, current)
    }
  }

  return Array.from(byTs.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, values]) => ({
      timestamp: new Date(ts * 1000).toISOString(),
      group: 'latency',
      ttft_ms: Math.round(
        values.reduce((sum, value) => sum + value, 0) / values.length
      ),
    }))
}

function toUptimeSeries(groups: PerformanceGroup[]): UptimeDayPoint[] {
  const byTs = new Map<number, { rates: number[]; incidents: number }>()
  for (const group of groups) {
    for (const point of group.series) {
      const current = byTs.get(point.ts) ?? { rates: [], incidents: 0 }
      if (Number.isFinite(point.success_rate)) {
        current.rates.push(point.success_rate)
        if (point.success_rate < 100) current.incidents += 1
      }
      byTs.set(point.ts, current)
    }
  }
  return Array.from(byTs.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, value]) => {
      const uptime =
        value.rates.length > 0
          ? value.rates.reduce((sum, rate) => sum + rate, 0) /
            value.rates.length
          : 0
      return {
        date: new Date(ts * 1000).toISOString(),
        uptime_pct: Math.round(uptime * 100) / 100,
        incidents: value.incidents,
        outage_minutes: 0,
      }
    })
}

function toGroupUptimeSeries(group: PerformanceGroup): UptimeDayPoint[] {
  return group.series.map((point) => ({
    date: new Date(point.ts * 1000).toISOString(),
    uptime_pct: Math.round(point.success_rate * 100) / 100,
    incidents: point.success_rate < 100 ? 1 : 0,
    outage_minutes: 0,
  }))
}

function average(
  rows: PerformanceRow[],
  field: 'avg_ttft_ms' | 'avg_latency_ms'
) {
  const values = rows.map((row) => row[field]).filter((value) => value > 0)
  if (values.length === 0) return 0
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  )
}

export function ModelDetailsPerformance(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const metricsQuery = useQuery({
    queryKey: ['perf-metrics', props.model.model_name],
    queryFn: () => getPerfMetrics(props.model.model_name, 24),
    staleTime: 60 * 1000,
  })
  const groups = useMemo(
    () => metricsQuery.data?.data.groups ?? [],
    [metricsQuery.data]
  )
  const performances = useMemo<PerformanceRow[]>(
    () =>
      groups.map((group) => ({
        group: group.group,
        avg_ttft_ms: group.avg_ttft_ms,
        avg_latency_ms: group.avg_latency_ms,
        success_rate: group.success_rate,
        avg_tps: group.avg_tps,
      })),
    [groups]
  )
  const latencySeries = useMemo(() => toLatencySeries(groups), [groups])
  const uptimeSeries = useMemo(() => toUptimeSeries(groups), [groups])
  const uptimeByGroup = useMemo<Record<string, UptimeDayPoint[]>>(() => {
    const map: Record<string, UptimeDayPoint[]> = {}
    for (const group of groups) {
      map[group.group] = toGroupUptimeSeries(group)
    }
    return map
  }, [groups])

  if (metricsQuery.isLoading || performances.length === 0) {
    return (
      <div className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>
        {t('Performance data is not yet available for this model.')}
      </div>
    )
  }

  const tpsValues = performances
    .map((p) => p.avg_tps)
    .filter((value) => value > 0)
  const avgTps =
    tpsValues.length > 0
      ? tpsValues.reduce((sum, value) => sum + value, 0) / tpsValues.length
      : 0
  const avgLatency = average(performances, 'avg_latency_ms')
  const successRates = performances
    .map((perf) => perf.success_rate)
    .filter((value) => Number.isFinite(value))
  const successRate =
    successRates.length > 0
      ? successRates.reduce((sum, value) => sum + value, 0) /
        successRates.length
      : 0
  const incidentCount = uptimeSeries.reduce((s, p) => s + p.incidents, 0)
  let intent: 'default' | 'warning' | 'success' = 'warning'
  if (successRate >= 99.9) {
    intent = 'success'
  } else if (successRate >= 99) {
    intent = 'default'
  }

  const headerCellClass =
    'text-muted-foreground py-2 text-[10px] font-medium tracking-wider uppercase'

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
        <StatCard
          icon={Timer}
          label='TPS'
          value={formatThroughput(avgTps)}
          hint={t('Sustained tokens per second')}
        />
        <StatCard
          icon={Timer}
          label={t('Average latency')}
          value={formatLatency(avgLatency)}
        />
        <StatCard
          icon={HeartPulse}
          label={t('Success rate')}
          value={formatUptimePct(successRate)}
          hint={
            incidentCount > 0
              ? t('{{count}} incidents in the last 24 hours', {
                  count: incidentCount,
                })
              : t('No incidents in the last 24 hours')
          }
          intent={intent}
        />
      </div>

      <section>
        <SectionHeader
          icon={HeartPulse}
          title={t('Per-group performance')}
          description={t('Average latency, TTFT, TPS, and success rate')}
        />
        <div className='overflow-x-auto rounded-lg border'>
          <Table className='text-sm'>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead className={headerCellClass}>{t('Group')}</TableHead>
                <TableHead className={`${headerCellClass} text-right`}>
                  TPS
                </TableHead>
                <TableHead className={`${headerCellClass} text-right`}>
                  {t('Average TTFT')}
                </TableHead>
                <TableHead className={`${headerCellClass} text-right`}>
                  {t('Average latency')}
                </TableHead>
                <TableHead
                  className={`${headerCellClass} min-w-[180px] text-left`}
                >
                  {t('Success rate')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performances.map((perf) => (
                <TableRow key={perf.group}>
                  <TableCell className='py-2.5'>
                    <GroupBadge group={perf.group} size='sm' />
                  </TableCell>
                  <TableCell className='py-2.5 text-right font-mono'>
                    {formatThroughput(perf.avg_tps)}
                  </TableCell>
                  <TableCell className='py-2.5 text-right font-mono'>
                    {formatLatency(perf.avg_ttft_ms)}
                  </TableCell>
                  <TableCell className='text-muted-foreground py-2.5 text-right font-mono'>
                    {formatLatency(perf.avg_latency_ms)}
                  </TableCell>
                  <TableCell className='py-2.5'>
                    <UptimeSparkline
                      size='sm'
                      series={uptimeByGroup[perf.group] ?? []}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <SectionHeader
          icon={Timer}
          title={t('Latency trend (last 24h)')}
          description={t('Average TTFT')}
        />
        <LatencyTrendChart series={latencySeries} />
      </section>

      <section>
        <SectionHeader
          icon={HeartPulse}
          title={t('Availability (last 24h)')}
          description={
            incidentCount > 0
              ? t(
                  'Request success rate; {{incidents}} incident buckets in the last 24 hours',
                  {
                    incidents: incidentCount,
                  }
                )
              : t('Request success rate sampled over the last 24 hours')
          }
          accent={
            incidentCount > 0 ? (
              <span className='inline-flex items-center gap-1 text-amber-600 dark:text-amber-400'>
                <AlertTriangle className='size-3.5' />
                {t('{{count}} incidents', {
                  count: incidentCount,
                })}
              </span>
            ) : null
          }
        />
        <UptimeTrendChart series={uptimeSeries} />
      </section>
    </div>
  )
}

function SectionHeader(props: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  accent?: React.ReactNode
}) {
  const Icon = props.icon
  return (
    <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
      <div className='flex min-w-0 items-center gap-2'>
        <Icon className='text-muted-foreground/70 size-3.5 shrink-0' />
        <div className='min-w-0'>
          <div className='text-foreground text-sm font-semibold'>
            {props.title}
          </div>
          {props.description && (
            <p className='text-muted-foreground/80 text-xs'>
              {props.description}
            </p>
          )}
        </div>
      </div>
      {props.accent && (
        <div className='shrink-0 text-xs font-medium'>{props.accent}</div>
      )}
    </div>
  )
}
