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
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CircleDollarSign,
  Hash,
  LineChart,
  RefreshCw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/status-badge'
import { getCodexLimitReport } from '@/features/dashboard/api'
import { TIME_RANGE_PRESETS } from '@/features/dashboard/constants'
import { CHANNEL_STATUS_CONFIG } from '@/features/channels/constants'
import type {
  CodexAdditionalLimit,
  CodexLimitReport,
  CodexLimitReportRow,
  CodexLimitWindow,
} from '@/features/dashboard/types'
import {
  buildCodexLimitReportTimeRange,
  isSameCodexLimitReportTimeRange,
} from './codex-limit-report-range'

function clampPercent(value: unknown): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 0
  return Math.max(0, Math.min(100, numericValue))
}

function formatPercent(value: unknown): string {
  const percent = clampPercent(value)
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`
}

function formatUnixSeconds(value?: number): string {
  if (!value || !Number.isFinite(value)) return '-'
  return dayjs(value * 1000).format('YYYY-MM-DD HH:mm')
}

function formatDurationSeconds(value?: number): string {
  if (!value || !Number.isFinite(value) || value <= 0) return '-'
  const total = Math.floor(value)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function windowTone(window?: CodexLimitWindow) {
  const percent = clampPercent(window?.used_percent)
  if (percent >= 95) return 'danger' as const
  if (percent >= 80) return 'warning' as const
  return 'info' as const
}

function WindowMeter(props: { label: string; window?: CodexLimitWindow }) {
  const { t } = useTranslation()
  const percent = clampPercent(props.window?.used_percent)

  return (
    <div className='min-w-0 space-y-1.5'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-muted-foreground text-[11px]'>
          {props.label}
        </span>
        <StatusBadge
          label={formatPercent(percent)}
          variant={windowTone(props.window)}
          copyable={false}
        />
      </div>
      <Progress value={percent} aria-label={`${props.label}: ${percent}%`} />
      <div className='text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[11px]'>
        <span>
          {t('Reset at:')} {formatUnixSeconds(props.window?.reset_at)}
        </span>
        <span>
          {t('Resets in:')}{' '}
          {formatDurationSeconds(props.window?.reset_after_seconds)}
        </span>
      </div>
    </div>
  )
}

function SummaryMetric(props: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string | number
  detail: string
}) {
  const Icon = props.icon

  return (
    <div className='rounded-lg border px-4 py-3'>
      <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
        <Icon className='size-3.5 shrink-0' aria-hidden='true' />
        <span>{props.label}</span>
      </div>
      <div
        className='mt-2 font-mono text-2xl font-semibold tabular-nums'
      >
        {props.value}
      </div>
      <div className='text-muted-foreground mt-1 text-xs'>{props.detail}</div>
    </div>
  )
}

function RangeStat(props: {
  label: string
  value: string
  detail?: string
  icon: ComponentType<{ className?: string }>
}) {
  const Icon = props.icon

  return (
    <div className='rounded-md border px-3 py-2.5'>
      <div className='text-muted-foreground flex items-center gap-2 text-xs'>
        <Icon className='size-3.5 shrink-0' aria-hidden='true' />
        <span>{props.label}</span>
      </div>
      <div className='mt-1.5 font-mono text-xl font-semibold tabular-nums'>
        {props.value}
      </div>
      {props.detail && (
        <div className='text-muted-foreground mt-1 text-[11px]'>
          {props.detail}
        </div>
      )}
    </div>
  )
}

function buildReportSummary(report?: CodexLimitReport) {
  return {
    total: report?.total_channels ?? 0,
    success: report?.success_count ?? 0,
    failure: report?.failure_count ?? 0,
    totalTokens: report?.total_token_used ?? 0,
    totalQuota: report?.total_quota ?? 0,
  }
}

function AdditionalLimits(props: { items?: CodexAdditionalLimit[] }) {
  const { t } = useTranslation()
  const items = props.items ?? []
  if (items.length === 0) {
    return <span className='text-muted-foreground text-xs'>-</span>
  }

  return (
    <div className='grid gap-2 lg:grid-cols-2'>
      {items.map((item, index) => (
        <div
          key={`${item.name}-${item.metered_feature ?? ''}-${index}`}
          className='bg-muted/30 rounded-md px-3 py-2.5'
        >
          <div className='mb-2 flex min-w-0 flex-wrap items-center gap-1.5'>
            <span className='min-w-0 truncate text-xs font-medium'>
              {item.name || t('Additional Restriction')}
            </span>
            {item.metered_feature && (
              <StatusBadge
                label={item.metered_feature}
                variant='neutral'
                copyable={false}
                className='max-w-40'
              />
            )}
          </div>
          <div className='grid gap-2 md:grid-cols-2'>
            <WindowMeter
              label={t('5-Hour Window')}
              window={item.five_hour_window}
            />
            <WindowMeter label={t('Weekly Window')} window={item.weekly_window} />
          </div>
        </div>
      ))}
    </div>
  )
}

function RowStatus(props: { row: CodexLimitReportRow }) {
  const { t } = useTranslation()
  if (!props.row.success) {
    return (
      <StatusBadge label={t('Failed')} variant='danger' copyable={false} />
    )
  }
  if (props.row.limit_reached) {
    return (
      <StatusBadge label={t('Limited')} variant='danger' copyable={false} />
    )
  }
  if (props.row.allowed) {
    return (
      <StatusBadge label={t('Available')} variant='success' copyable={false} />
    )
  }
  return <StatusBadge label={t('Unknown')} variant='neutral' copyable={false} />
}

function ChannelStatus(props: { status: number }) {
  const { t } = useTranslation()
  const config =
    CHANNEL_STATUS_CONFIG[
      props.status as keyof typeof CHANNEL_STATUS_CONFIG
    ] ?? CHANNEL_STATUS_CONFIG[0]

  return (
    <StatusBadge
      label={t(config.label)}
      variant={config.variant}
      copyable={false}
    />
  )
}

function ChannelPanel(props: { row: CodexLimitReportRow }) {
  const { t } = useTranslation()

  return (
    <div className='space-y-4 rounded-lg border p-4'>
      <div className='flex min-w-0 flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0 space-y-1'>
          <div className='flex min-w-0 flex-wrap items-center gap-2'>
            <h3 className='min-w-0 truncate text-base font-semibold'>
              {props.row.channel_name || `#${props.row.channel_id}`}
            </h3>
            <RowStatus row={props.row} />
            <ChannelStatus status={props.row.channel_status} />
          </div>
          <div className='text-muted-foreground flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs'>
            <span>#{props.row.channel_id}</span>
            <span>{props.row.email || props.row.account_id || '-'}</span>
            {props.row.plan_type && <span>{props.row.plan_type}</span>}
            {typeof props.row.upstream_status === 'number' && (
              <span>{props.row.upstream_status}</span>
            )}
          </div>
        </div>
        {props.row.message && (
          <div className='border-destructive/30 bg-destructive/5 text-destructive max-w-full rounded-md border px-3 py-2 text-xs'>
            {props.row.message}
          </div>
        )}
      </div>

      <div className='grid gap-3 md:grid-cols-2'>
        <RangeStat
          icon={LineChart}
          label={t('Range Tokens')}
          value={formatCompactNumber(props.row.range_token_used)}
          detail={t('Selected range usage')}
        />
        <RangeStat
          icon={CircleDollarSign}
          label={t('Range Amount')}
          value={formatQuota(props.row.range_quota)}
          detail={formatNumber(props.row.range_quota)}
        />
      </div>

      <div className='grid gap-3 md:grid-cols-2'>
        <WindowMeter
          label={t('5-Hour Window')}
          window={props.row.base_five_hour_window}
        />
        <WindowMeter
          label={t('Weekly Window')}
          window={props.row.base_weekly_window}
        />
      </div>

      <div className='space-y-2'>
        <div className='text-sm font-medium'>
          {t('Additional Restrictions')}
        </div>
        <AdditionalLimits items={props.row.additional_limits} />
      </div>
    </div>
  )
}

function CodexChannelTabs(props: { rows: CodexLimitReportRow[] }) {
  const { t } = useTranslation()
  const [activeChannel, setActiveChannel] = useState('')

  useEffect(() => {
    if (props.rows.length === 0) {
      setActiveChannel('')
      return
    }
    const currentExists = props.rows.some(
      (row) => String(row.channel_id) === activeChannel
    )
    if (!currentExists) {
      setActiveChannel(String(props.rows[0].channel_id))
    }
  }, [props.rows, activeChannel])

  return (
    <Tabs value={activeChannel} onValueChange={setActiveChannel} className='gap-3'>
      <TabsList className='max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto'>
        {props.rows.map((row) => (
          <TabsTrigger
            key={row.channel_id}
            value={String(row.channel_id)}
            className='h-auto min-h-8 max-w-52 gap-1.5'
          >
            <span className='min-w-0 truncate'>
              {row.channel_name || `#${row.channel_id}`}
            </span>
            {!row.success && (
              <AlertTriangle
                className='text-destructive size-3.5 shrink-0'
                aria-hidden='true'
              />
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {props.rows.length === 0 && (
        <div className='text-muted-foreground text-xs'>
          {t('No Codex channels found')}
        </div>
      )}
      {props.rows.map((row) => (
        <TabsContent key={row.channel_id} value={String(row.channel_id)}>
          <ChannelPanel row={row} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function CodexReportSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-1.5'>
        <Skeleton className='h-8 w-64' />
      </div>
      <div className='grid gap-3 md:grid-cols-3'>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className='rounded-lg border px-4 py-3'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='mt-3 h-8 w-16' />
            <Skeleton className='mt-2 h-3 w-32' />
          </div>
        ))}
      </div>
      <div className='rounded-lg border p-4'>
        <Skeleton className='h-72 w-full' />
      </div>
    </div>
  )
}

export function CodexLimitReportPanel() {
  const { t } = useTranslation()
  const [selectedRange, setSelectedRange] = useState(7)
  const [timeRange, setTimeRange] = useState(() =>
    buildCodexLimitReportTimeRange(7)
  )

  const handleRangeChange = useCallback((days: number) => {
    setSelectedRange(days)
    setTimeRange(buildCodexLimitReportTimeRange(days))
  }, [])

  const reportQuery = useQuery({
    queryKey: ['dashboard', 'codex-limit-report', timeRange],
    queryFn: () => getCodexLimitReport(timeRange),
    staleTime: 30 * 1000,
    retry: false,
  })

  const handleRefresh = useCallback(() => {
    const nextRange = buildCodexLimitReportTimeRange(selectedRange)
    if (isSameCodexLimitReportTimeRange(timeRange, nextRange)) {
      void reportQuery.refetch()
      return
    }
    setTimeRange(nextRange)
  }, [reportQuery, selectedRange, timeRange])

  const report = reportQuery.data?.success ? reportQuery.data.data : undefined
  const summary = useMemo(() => buildReportSummary(report), [report])
  const rangeLabel = `${formatUnixSeconds(report?.start_timestamp ?? timeRange.start_timestamp)} - ${formatUnixSeconds(report?.end_timestamp ?? timeRange.end_timestamp)}`

  if (reportQuery.isLoading) {
    return <CodexReportSkeleton />
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <div className='flex shrink-0 items-center gap-1.5 rounded-lg border p-0.5'>
            {TIME_RANGE_PRESETS.map((preset) => (
              <button
                key={preset.days}
                type='button'
                onClick={() => handleRangeChange(preset.days)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedRange === preset.days
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {t(preset.label)}
              </button>
            ))}
          </div>
          <div className='text-muted-foreground truncate text-xs'>
            {rangeLabel}
          </div>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={handleRefresh}
          disabled={reportQuery.isFetching}
        >
          <RefreshCw
            className={cn('size-3.5', reportQuery.isFetching && 'animate-spin')}
          />
          {t('Refresh')}
        </Button>
      </div>

      {(reportQuery.isError || reportQuery.data?.success === false) && (
        <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm'>
          {reportQuery.data?.success === false
            ? reportQuery.data.message
            : t('Failed to fetch Codex limits')}
        </div>
      )}

      <div className='grid gap-3 md:grid-cols-3'>
        <SummaryMetric
          icon={Hash}
          label={t('Codex Channels')}
          value={summary.total}
          detail={`${summary.success} ${t('Available')}, ${summary.failure} ${t('Failed')}`}
        />
        <SummaryMetric
          icon={LineChart}
          label={t('Total Tokens')}
          value={formatCompactNumber(summary.totalTokens)}
          detail={t('Selected range usage')}
        />
        <SummaryMetric
          icon={CircleDollarSign}
          label={t('Amount')}
          value={formatQuota(summary.totalQuota)}
          detail={formatNumber(summary.totalQuota)}
        />
      </div>

      <CodexChannelTabs rows={report?.rows ?? []} />
    </div>
  )
}
