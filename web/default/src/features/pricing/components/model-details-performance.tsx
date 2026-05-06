import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  HeartPulse,
  Timer,
  TrendingUp,
} from 'lucide-react'
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
import { getPerfMetrics, type PerformanceGroup } from '../api'
import {
  formatLatency,
  formatUptimePct,
  type UptimeDayPoint,
} from '../lib/mock-stats'
import type { PricingModel } from '../types'
import { LatencyTrendChart, UptimeBarChart } from './model-details-charts'
import { UptimeSparkline } from './model-details-uptime-sparkline'

const COMPACT_NUMBER = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
})

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
  request_count: number
}

function toLatencySeries(groups: PerformanceGroup[]) {
  return groups.flatMap((group) =>
    group.series
      .filter((point) => point.ttft_count > 0 && point.avg_ttft_ms > 0)
      .map((point) => ({
        timestamp: new Date(point.ts * 1000).toISOString(),
        group: group.group,
        ttft_ms: point.avg_ttft_ms,
      }))
  )
}

function toUptimeSeries(groups: PerformanceGroup[]): UptimeDayPoint[] {
  const byTs = new Map<number, { count: number; success: number }>()
  for (const group of groups) {
    for (const point of group.series) {
      const current = byTs.get(point.ts) ?? { count: 0, success: 0 }
      current.count += point.count
      current.success += point.success_count
      byTs.set(point.ts, current)
    }
  }
  return Array.from(byTs.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, value]) => {
      const uptime = value.count > 0 ? (value.success / value.count) * 100 : 0
      return {
        date: new Date(ts * 1000).toISOString(),
        uptime_pct: Math.round(uptime * 100) / 100,
        incidents: value.success < value.count ? 1 : 0,
        outage_minutes: 0,
      }
    })
}

function toGroupUptimeSeries(group: PerformanceGroup): UptimeDayPoint[] {
  return group.series.map((point) => ({
    date: new Date(point.ts * 1000).toISOString(),
    uptime_pct: Math.round(point.success_rate * 100) / 100,
    incidents: point.success_count < point.count ? 1 : 0,
    outage_minutes: 0,
  }))
}

function weightedAverage(
  rows: PerformanceRow[],
  field: 'avg_ttft_ms' | 'avg_latency_ms'
): number {
  let total = 0
  let count = 0
  for (const row of rows) {
    if (row[field] <= 0 || row.request_count <= 0) continue
    total += row[field] * row.request_count
    count += row.request_count
  }
  return count > 0 ? Math.round(total / count) : 0
}

export function ModelDetailsPerformance(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const metricsQuery = useQuery({
    queryKey: ['perf-metrics', props.model.model_name],
    queryFn: () => getPerfMetrics(props.model.model_name, 24),
    staleTime: 60 * 1000,
  })
  const groups = metricsQuery.data?.data.groups ?? []
  const performances = useMemo<PerformanceRow[]>(
    () =>
      groups.map((group) => ({
        group: group.group,
        avg_ttft_ms: group.avg_ttft_ms,
        avg_latency_ms: group.avg_latency_ms,
        success_rate: group.success_rate,
        request_count: group.request_count,
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

  const ttftValues = performances
    .map((p) => p.avg_ttft_ms)
    .filter((value) => value > 0)
  const bestTtft = ttftValues.length > 0 ? Math.min(...ttftValues) : 0
  const avgLatency = weightedAverage(performances, 'avg_latency_ms')
  const totalRequests = performances.reduce((s, p) => s + p.request_count, 0)
  const totalSuccess = groups.reduce((s, p) => s + p.success_count, 0)
  const successRate =
    totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0
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
      <div className='grid grid-cols-2 gap-2 lg:grid-cols-4'>
        <StatCard
          icon={Timer}
          label={t('Best TTFT')}
          value={formatLatency(bestTtft)}
          hint={t('Lowest median first-token latency')}
        />
        <StatCard
          icon={Timer}
          label={t('Average latency')}
          value={formatLatency(avgLatency)}
          hint={t('Across all groups')}
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
        <StatCard
          icon={TrendingUp}
          label={t('Requests (24h)')}
          value={COMPACT_NUMBER.format(totalRequests)}
          hint={t('Aggregated across enabled groups')}
        />
      </div>

      <section>
        <SectionHeader
          icon={Activity}
          title={t('Per-group performance')}
          description={t('Average latency, TTFT, and success rate by group')}
        />
        <div className='overflow-x-auto rounded-lg border'>
          <Table className='text-sm'>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead className={headerCellClass}>{t('Group')}</TableHead>
                <TableHead className={`${headerCellClass} text-right`}>
                  {t('Average TTFT')}
                </TableHead>
                <TableHead className={`${headerCellClass} text-right`}>
                  {t('Average latency')}
                </TableHead>
                <TableHead
                  className={`${headerCellClass} min-w-[160px] text-left`}
                >
                  {t('Success rate')}
                </TableHead>
                <TableHead className={`${headerCellClass} text-right`}>
                  {t('Request Count')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performances.map((perf) => {
                const isBestTtft = perf.avg_ttft_ms === bestTtft
                return (
                  <TableRow key={perf.group}>
                    <TableCell className='py-2.5'>
                      <GroupBadge group={perf.group} size='sm' />
                    </TableCell>
                    <TableCell
                      className={cn(
                        'py-2.5 text-right font-mono',
                        isBestTtft && 'text-emerald-600 dark:text-emerald-400'
                      )}
                    >
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
                    <TableCell className='text-muted-foreground py-2.5 text-right font-mono'>
                      {COMPACT_NUMBER.format(perf.request_count)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <SectionHeader
          icon={Timer}
          title={t('Latency trend (last 24h)')}
          description={t('Average time-to-first-token (TTFT) by group')}
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
        <UptimeBarChart series={uptimeSeries} />
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
