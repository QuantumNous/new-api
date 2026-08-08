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
/* eslint-disable react-refresh/only-export-components */
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { GroupBadge } from '@/components/group-badge'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  adminPerformanceHealthRank,
  type AdminPerformanceTableRow,
} from '@/features/performance-metrics/lib/admin'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import type { AdminPerformanceHealth } from '@/features/performance-metrics/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const HEALTH_CONFIG: Record<
  AdminPerformanceHealth,
  { label: string; variant: StatusVariant }
> = {
  critical: { label: 'Critical', variant: 'danger' },
  degraded: { label: 'Degraded', variant: 'warning' },
  healthy: { label: 'Healthy', variant: 'success' },
  insufficient_samples: {
    label: 'Insufficient samples',
    variant: 'neutral',
  },
  no_samples: { label: 'No performance samples', variant: 'neutral' },
}

const HEALTH_REASON_KEYS: Record<string, string> = {
  success_rate_critical: 'Success rate is below 90%',
  success_rate_regression_critical:
    'Success rate dropped by at least 10 percentage points',
  success_rate_degraded: 'Success rate is below 98%',
  success_rate_regression:
    'Success rate dropped by at least 3 percentage points',
  latency_regression: 'Average latency increased significantly',
  ttft_regression: 'TTFT increased significantly',
  tps_regression: 'Output TPS decreased significantly',
  insufficient_samples: 'There are not enough requests to assess health',
  no_samples: 'No relay performance samples were recorded',
}

type ChangeDirection = 'higher' | 'lower' | 'neutral'

function MetricValue(props: {
  value: string
  change?: number | null
  changeSuffix?: '%' | ' pp'
  direction?: ChangeDirection
  title?: string
}) {
  const change = props.change
  const hasChange = typeof change === 'number' && Number.isFinite(change)
  let changeClassName = 'text-muted-foreground'
  if (hasChange && change !== 0 && props.direction !== 'neutral') {
    const improved = props.direction === 'higher' ? change > 0 : change < 0
    changeClassName = improved ? 'text-success' : 'text-destructive'
  }

  let ChangeIcon: typeof ArrowUp | null = null
  if (hasChange && change > 0) ChangeIcon = ArrowUp
  if (hasChange && change < 0) ChangeIcon = ArrowDown

  return (
    <div
      className='flex min-w-0 flex-col items-end gap-0.5'
      title={props.title}
    >
      <span className='font-mono text-sm font-medium tabular-nums'>
        {props.value}
      </span>
      {hasChange && (
        <span
          className={cn(
            'inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums',
            changeClassName
          )}
        >
          {ChangeIcon && <ChangeIcon aria-hidden='true' className='size-2.5' />}
          {Math.abs(change).toFixed(2)}
          {props.changeSuffix ?? '%'}
        </span>
      )}
    </div>
  )
}

function unavailable(row: AdminPerformanceTableRow): boolean {
  return !row.metrics_enabled
}

export function useModelPerformanceColumns(): ColumnDef<AdminPerformanceTableRow>[] {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  return [
    {
      accessorKey: 'model_name',
      header: t('Model'),
      meta: { label: t('Model'), pinned: 'left' },
      cell: ({ row }) => {
        if (row.original.kind === 'group') {
          return (
            <div className='flex min-w-0 items-center gap-2 pl-7'>
              <GroupBadge group={row.original.group_name} />
            </div>
          )
        }
        const canExpand = row.getCanExpand()
        return (
          <div className='flex min-w-0 items-center gap-1.5'>
            {canExpand ? (
              <Button
                variant='ghost'
                size='icon-xs'
                onClick={row.getToggleExpandedHandler()}
                aria-expanded={row.getIsExpanded()}
                aria-label={`${t(row.getIsExpanded() ? 'Collapse' : 'Expand')} ${row.original.model_name}`}
              >
                {row.getIsExpanded() ? <ChevronDown /> : <ChevronRight />}
              </Button>
            ) : (
              <span className='size-6' aria-hidden='true' />
            )}
            <span className='min-w-0 truncate font-mono text-sm font-medium'>
              {row.original.model_name}
            </span>
          </div>
        )
      },
      filterFn: (row, _id, value) => {
        const query = String(value ?? '')
          .trim()
          .toLowerCase()
        return !query || row.original.model_name.toLowerCase().includes(query)
      },
      size: 260,
      minSize: 220,
    },
    {
      accessorKey: 'health',
      header: t('Health'),
      meta: { label: t('Health'), pinned: 'left' },
      cell: ({ row }) => {
        if (!row.original.metrics_enabled) {
          return <span className='text-muted-foreground'>—</span>
        }
        const config = HEALTH_CONFIG[row.original.health]
        const reasons = row.original.health_reasons
        const badge = (
          <StatusBadge
            label={t(config.label)}
            variant={config.variant}
            copyable={false}
            showDot
          />
        )
        if (reasons.length === 0) return badge
        return (
          <Tooltip>
            <TooltipTrigger render={<span className='inline-flex' />}>
              {badge}
            </TooltipTrigger>
            <TooltipContent className='max-w-xs'>
              <ul className='space-y-1 text-xs'>
                {reasons.map((reason) => (
                  <li key={reason}>
                    {t(HEALTH_REASON_KEYS[reason] ?? reason)}
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )
      },
      sortingFn: (left, right) =>
        adminPerformanceHealthRank(left.original.health) -
        adminPerformanceHealthRank(right.original.health),
      filterFn: (row, id, value) =>
        !value?.length || value.includes(String(row.getValue(id))),
      size: 160,
      minSize: 150,
    },
    {
      accessorKey: 'enabled',
      header: t('Status'),
      meta: { label: t('Status') },
      cell: ({ row }) => (
        <StatusBadge
          label={t(row.original.enabled ? 'Enabled' : 'Disabled')}
          variant={row.original.enabled ? 'success' : 'neutral'}
          copyable={false}
        />
      ),
      filterFn: (row, id, value) =>
        !value?.length || value.includes(String(row.getValue(id))),
      size: 100,
    },
    {
      id: 'request_count',
      accessorFn: (row) => row.metrics.request_count,
      header: t('Requests'),
      meta: { label: t('Requests') },
      cell: ({ row }) => (
        <MetricValue
          value={
            unavailable(row.original)
              ? '—'
              : formatNumber(row.original.metrics.request_count, locale)
          }
          change={row.original.changes.request_count_pct}
          direction='neutral'
        />
      ),
      size: 115,
    },
    {
      id: 'failure_count',
      accessorFn: (row) => row.metrics.failure_count,
      header: t('Failures'),
      meta: { label: t('Failures') },
      cell: ({ row }) => (
        <MetricValue
          value={
            unavailable(row.original)
              ? '—'
              : formatNumber(row.original.metrics.failure_count, locale)
          }
        />
      ),
      size: 100,
    },
    {
      id: 'success_rate',
      accessorFn: (row) => row.metrics.success_rate ?? -1,
      header: t('Success rate'),
      meta: { label: t('Success rate') },
      cell: ({ row }) => (
        <MetricValue
          value={
            unavailable(row.original) ||
            row.original.metrics.success_rate == null
              ? '—'
              : formatUptimePct(row.original.metrics.success_rate)
          }
          change={row.original.changes.success_rate_pp}
          changeSuffix=' pp'
          direction='higher'
        />
      ),
      size: 125,
    },
    {
      id: 'avg_ttft_ms',
      accessorFn: (row) => row.metrics.avg_ttft_ms ?? -1,
      header: t('TTFT'),
      meta: { label: t('TTFT') },
      cell: ({ row }) => (
        <MetricValue
          value={
            unavailable(row.original) ||
            row.original.metrics.avg_ttft_ms == null
              ? '—'
              : formatLatency(row.original.metrics.avg_ttft_ms)
          }
          change={row.original.changes.avg_ttft_pct}
          direction='lower'
          title={t('{{count}} TTFT samples', {
            count: row.original.metrics.ttft_sample_count,
          })}
        />
      ),
      size: 115,
    },
    {
      id: 'avg_latency_ms',
      accessorFn: (row) => row.metrics.avg_latency_ms ?? -1,
      header: t('Average latency'),
      meta: { label: t('Average latency') },
      cell: ({ row }) => (
        <MetricValue
          value={
            unavailable(row.original) ||
            row.original.metrics.avg_latency_ms == null
              ? '—'
              : formatLatency(row.original.metrics.avg_latency_ms)
          }
          change={row.original.changes.avg_latency_pct}
          direction='lower'
        />
      ),
      size: 140,
    },
    {
      id: 'avg_tps',
      accessorFn: (row) => row.metrics.avg_tps ?? -1,
      header: t('Output TPS'),
      meta: { label: t('Output TPS') },
      cell: ({ row }) => (
        <MetricValue
          value={
            unavailable(row.original) || row.original.metrics.avg_tps == null
              ? '—'
              : formatThroughput(row.original.metrics.avg_tps)
          }
          change={row.original.changes.avg_tps_pct}
          direction='higher'
        />
      ),
      size: 120,
    },
    {
      id: 'output_tokens',
      accessorFn: (row) => row.metrics.output_tokens,
      header: t('Output tokens'),
      meta: { label: t('Output tokens') },
      cell: ({ row }) => (
        <MetricValue
          value={
            unavailable(row.original)
              ? '—'
              : formatNumber(row.original.metrics.output_tokens, locale)
          }
        />
      ),
      size: 130,
    },
    {
      id: 'groups',
      accessorFn: (row) => row.group_names,
      header: t('Active groups'),
      meta: { label: t('Active groups') },
      cell: ({ row }) => (
        <MetricValue
          value={
            row.original.kind === 'group' || unavailable(row.original)
              ? '—'
              : formatNumber(row.original.metrics.active_group_count, locale)
          }
        />
      ),
      filterFn: (row, _id, value) =>
        !value?.length ||
        value.some((group: string) => row.original.group_names.includes(group)),
      size: 115,
    },
  ]
}
