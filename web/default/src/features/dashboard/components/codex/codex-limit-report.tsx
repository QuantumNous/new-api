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
import { AlertTriangle, Gauge, RefreshCw, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { getCodexLimitReport } from '@/features/dashboard/api'
import { CHANNEL_STATUS_CONFIG } from '@/features/channels/constants'
import type {
  CodexAdditionalLimit,
  CodexLimitReport,
  CodexLimitReportRow,
  CodexLimitWindow,
} from '@/features/dashboard/types'

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
    <div className='min-w-36 space-y-1.5'>
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
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  detail: string
  tone?: 'default' | 'warning' | 'danger'
}) {
  const Icon = props.icon

  return (
    <div className='rounded-lg border px-4 py-3'>
      <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
        <Icon className='size-3.5 shrink-0' aria-hidden='true' />
        <span>{props.label}</span>
      </div>
      <div
        className={cn(
          'mt-2 font-mono text-2xl font-semibold tabular-nums',
          props.tone === 'warning' && 'text-warning',
          props.tone === 'danger' && 'text-destructive'
        )}
      >
        {props.value}
      </div>
      <div className='text-muted-foreground mt-1 text-xs'>{props.detail}</div>
    </div>
  )
}

function maxWindowPercent(
  rows: CodexLimitReportRow[],
  getWindow: (row: CodexLimitReportRow) => CodexLimitWindow | undefined
): number {
  return rows.reduce((max, row) => {
    if (!row.success) return max
    return Math.max(max, clampPercent(getWindow(row)?.used_percent))
  }, 0)
}

function buildReportSummary(report?: CodexLimitReport) {
  const rows = report?.rows ?? []
  return {
    total: report?.total_channels ?? 0,
    success: report?.success_count ?? 0,
    failure: report?.failure_count ?? 0,
    maxFiveHour: maxWindowPercent(rows, (row) => row.base_five_hour_window),
    maxWeekly: maxWindowPercent(rows, (row) => row.base_weekly_window),
  }
}

function AdditionalLimits(props: { items?: CodexAdditionalLimit[] }) {
  const { t } = useTranslation()
  const items = props.items ?? []
  if (items.length === 0) {
    return <span className='text-muted-foreground text-xs'>-</span>
  }

  return (
    <div className='space-y-2'>
      {items.map((item, index) => (
        <div
          key={`${item.name}-${item.metered_feature ?? ''}-${index}`}
          className='bg-muted/30 rounded-md px-2.5 py-2'
        >
          <div className='mb-2 flex min-w-0 flex-wrap items-center gap-1.5'>
            <span className='min-w-0 truncate text-xs font-medium'>
              {item.name || t('Additional Limit')}
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

function CodexLimitRows(props: { rows: CodexLimitReportRow[] }) {
  const { t } = useTranslation()

  if (props.rows.length === 0) {
    return (
      <div className='text-muted-foreground rounded-lg border px-4 py-8 text-center text-sm'>
        {t('No Codex channels found')}
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[980px] text-left text-sm'>
          <thead className='bg-muted/40 text-muted-foreground text-xs'>
            <tr>
              <th className='px-4 py-3 font-medium'>{t('Channel')}</th>
              <th className='px-4 py-3 font-medium'>{t('Account')}</th>
              <th className='px-4 py-3 font-medium'>{t('Status')}</th>
              <th className='px-4 py-3 font-medium'>{t('Base Limits')}</th>
              <th className='px-4 py-3 font-medium'>
                {t('Additional Limits')}
              </th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {props.rows.map((row) => (
              <tr key={row.channel_id} className='align-top'>
                <td className='px-4 py-3'>
                  <div className='max-w-56 space-y-1'>
                    <div className='truncate font-medium'>
                      {row.channel_name || `#${row.channel_id}`}
                    </div>
                    <div className='text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs'>
                      <span>#{row.channel_id}</span>
                      <ChannelStatus status={row.channel_status} />
                    </div>
                  </div>
                </td>
                <td className='px-4 py-3'>
                  <div className='max-w-64 space-y-1.5'>
                    <div className='flex flex-wrap items-center gap-1.5'>
                      <StatusBadge
                        label={row.plan_type || t('Unknown')}
                        variant='blue'
                        copyable={false}
                      />
                      {typeof row.upstream_status === 'number' && (
                        <StatusBadge
                          label={`${row.upstream_status}`}
                          variant={row.success ? 'neutral' : 'danger'}
                          copyable={false}
                        />
                      )}
                    </div>
                    <div className='text-muted-foreground truncate text-xs'>
                      {row.email || row.account_id || '-'}
                    </div>
                    {row.message && (
                      <div className='text-destructive text-xs'>
                        {row.message}
                      </div>
                    )}
                  </div>
                </td>
                <td className='px-4 py-3'>
                  <RowStatus row={row} />
                </td>
                <td className='px-4 py-3'>
                  <div className='grid gap-3 md:grid-cols-2'>
                    <WindowMeter
                      label={t('5-Hour Window')}
                      window={row.base_five_hour_window}
                    />
                    <WindowMeter
                      label={t('Weekly Window')}
                      window={row.base_weekly_window}
                    />
                  </div>
                </td>
                <td className='px-4 py-3'>
                  <AdditionalLimits items={row.additional_limits} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CodexReportSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='grid gap-3 md:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
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
  const reportQuery = useQuery({
    queryKey: ['dashboard', 'codex-limit-report'],
    queryFn: getCodexLimitReport,
    staleTime: 30 * 1000,
    retry: false,
  })

  const report = reportQuery.data?.data
  const summary = useMemo(() => buildReportSummary(report), [report])

  if (reportQuery.isLoading) {
    return <CodexReportSkeleton />
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='text-muted-foreground text-xs'>
          {report?.generated_at
            ? `${t('Updated at')} ${formatUnixSeconds(report.generated_at)}`
            : t('Codex upstream quota report')}
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => void reportQuery.refetch()}
          disabled={reportQuery.isFetching}
        >
          <RefreshCw
            className={cn('size-3.5', reportQuery.isFetching && 'animate-spin')}
          />
          {t('Refresh')}
        </Button>
      </div>

      {reportQuery.isError && (
        <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm'>
          {t('Failed to fetch Codex limits')}
        </div>
      )}

      <div className='grid gap-3 md:grid-cols-4'>
        <SummaryMetric
          icon={Gauge}
          label={t('Codex Channels')}
          value={summary.total}
          detail={`${summary.success} ${t('Available')}, ${summary.failure} ${t('Failed')}`}
        />
        <SummaryMetric
          icon={ShieldCheck}
          label={t('Successful Channels')}
          value={summary.success}
          detail={t('Channels with live upstream quota data')}
        />
        <SummaryMetric
          icon={AlertTriangle}
          label={t('Max 5-hour Usage')}
          value={formatPercent(summary.maxFiveHour)}
          detail={t('Highest base window usage')}
          tone={summary.maxFiveHour >= 80 ? 'warning' : 'default'}
        />
        <SummaryMetric
          icon={AlertTriangle}
          label={t('Max Weekly Usage')}
          value={formatPercent(summary.maxWeekly)}
          detail={t('Highest weekly window usage')}
          tone={summary.maxWeekly >= 80 ? 'warning' : 'default'}
        />
      </div>

      <CodexLimitRows rows={report?.rows ?? []} />
    </div>
  )
}
