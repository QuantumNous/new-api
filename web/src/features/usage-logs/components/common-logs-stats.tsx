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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatLogQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import { getLogStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS, LOG_TYPE_ENUM } from '../constants'
import { buildApiParams, getDefaultTimeRange } from '../lib/utils'
import { useLogsViewScope, useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

const REFRESH_INTERVALS = [0, 30, 60, 300] as const
type RefreshInterval = (typeof REFRESH_INTERVALS)[number]

function refreshLabel(ms: number): string {
  if (ms === 0) return 'Off'
  if (ms < 60_000) return `${ms / 1000}s`
  return `${ms / 60_000}m`
}

function StatBadge(props: {
  label: string
  value: string | number
  accent: string
  title?: string
  onClick?: () => void
}) {
  const Tag = props.onClick ? 'button' : 'span'
  return (
    <Tag
      type={props.onClick ? 'button' : undefined}
      className={cn(
        'border-border/60 bg-muted/25 inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs shadow-xs',
        props.onClick &&
          'hover:bg-muted/60 hover:border-border cursor-pointer transition-colors'
      )}
      title={props.title}
      onClick={props.onClick}
    >
      <span className={cn('h-3.5 w-0.5 rounded-full', props.accent)} />
      <span className='text-muted-foreground'>{props.label}</span>
      <span className='text-foreground/85 font-mono font-semibold tabular-nums'>
        {props.value}
      </span>
    </Tag>
  )
}

function formatAvgTime(seconds: number): string {
  if (seconds <= 0) return '—'
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  return `${seconds.toFixed(1)}s`
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function calcRpm(requests: number, minutes: number): string {
  if (minutes <= 0 || requests <= 0) return '0'
  const rpm = requests / minutes
  return rpm < 1 ? rpm.toFixed(2) : Math.round(rpm).toLocaleString()
}

function calcTpm(tokens: number, minutes: number): string {
  if (minutes <= 0 || tokens <= 0) return '0'
  const tpm = tokens / minutes
  return tpm < 1 ? tpm.toFixed(1) : Math.round(tpm).toLocaleString()
}

export function CommonLogsStats() {
  const { t } = useTranslation()
  const { isAdminView: isAdmin } = useLogsViewScope()
  const searchParams = route.useSearch()
  const { sensitiveVisible } = useUsageLogsContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [refreshIntervalIdx, setRefreshIntervalIdx] = useState(0)
  const refreshMs = REFRESH_INTERVALS[refreshIntervalIdx] * 1000

  const { data: stats, isLoading, isFetching } = useQuery({
    queryKey: ['usage-logs-stats', isAdmin, searchParams],
    queryFn: async () => {
      const params = buildApiParams({
        page: 1,
        pageSize: 1,
        searchParams,
        columnFilters: [],
        isAdmin,
      })
      const result = isAdmin
        ? await getLogStats(params)
        : await getUserLogStats(params)
      return result.success ? result.data || DEFAULT_LOG_STATS : DEFAULT_LOG_STATS
    },
    placeholderData: (previousData) => previousData,
    refetchInterval: refreshMs > 0 ? refreshMs : false,
  })

  const rangeMinutes = (() => {
    const { start, end } = getDefaultTimeRange()
    const startMs = (searchParams.startTime as number | undefined) ?? start.getTime()
    const endMs = (searchParams.endTime as number | undefined) ?? end.getTime()
    return Math.max((endMs - startMs) / 60_000, 1)
  })()

  const todayMinutes = (() => {
    const now = new Date()
    return Math.max((now.getHours() * 60 + now.getMinutes()) || 1, 1)
  })()

  const goToToday = () => {
    const now = new Date()
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now.getTime() + 3600 * 1000)
    navigate({
      to: '/usage-logs/$section',
      params: { section: 'common' },
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        startTime: start.getTime(),
        endTime: end.getTime(),
        page: 1,
      }),
    })
    queryClient.invalidateQueries({ queryKey: ['logs'] })
    queryClient.invalidateQueries({ queryKey: ['usage-logs-stats'] })
  }

  const goToErrors = () => {
    navigate({
      to: '/usage-logs/$section',
      params: { section: 'common' },
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        type: [String(LOG_TYPE_ENUM.ERROR)],
        page: 1,
      }),
    })
    queryClient.invalidateQueries({ queryKey: ['logs'] })
    queryClient.invalidateQueries({ queryKey: ['usage-logs-stats'] })
  }

  const cycleRefresh = () => {
    setRefreshIntervalIdx((i) => (i + 1) % REFRESH_INTERVALS.length)
  }

  if (isLoading) {
    return (
      <div className='flex flex-wrap items-center gap-2'>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className='h-7 w-[110px] rounded-md' />
        ))}
      </div>
    )
  }

  const s = stats ?? DEFAULT_LOG_STATS

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <StatBadge
        label={t('Usage')}
        value={sensitiveVisible ? formatLogQuota(s.quota) : '••••'}
        accent='bg-sky-500/70'
      />
      <StatBadge
        label={t('Total Req')}
        value={formatCount(s.total_requests)}
        accent='bg-indigo-400/70'
        title={t('Total consume requests in selected range')}
      />
      <StatBadge
        label={t('Today Req')}
        value={formatCount(s.today_requests)}
        accent='bg-violet-400/70'
        title={t('Consume requests since today 00:00')}
        onClick={goToToday}
      />
      <StatBadge
        label={t('Range RPM')}
        value={calcRpm(s.total_requests, rangeMinutes)}
        accent='bg-rose-500/65'
        title={t('Average requests per minute over selected range')}
      />
      <StatBadge
        label={t('Today RPM')}
        value={calcRpm(s.today_requests, todayMinutes)}
        accent='bg-pink-400/65'
        title={t('Average requests per minute since today 00:00')}
        onClick={goToToday}
      />
      <StatBadge
        label={t('Range TPM')}
        value={calcTpm(s.total_tokens, rangeMinutes)}
        accent='bg-slate-400/70'
        title={t('Average tokens per minute over selected range')}
      />
      <StatBadge
        label={t('Today TPM')}
        value={calcTpm(s.today_tokens, todayMinutes)}
        accent='bg-zinc-400/70'
        title={t('Average tokens per minute since today 00:00')}
        onClick={goToToday}
      />
      <StatBadge
        label={t('Avg Latency')}
        value={formatAvgTime(s.avg_use_time)}
        accent='bg-amber-400/70'
        title={t('Average response time for consume requests')}
      />
      <StatBadge
        label={t('Errors')}
        value={formatCount(s.error_count)}
        accent='bg-red-500/65'
        title={t('Error log count in selected range')}
        onClick={goToErrors}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type='button'
              variant='ghost'
              size='icon'
              onClick={cycleRefresh}
              className={cn(
                'text-muted-foreground hover:text-foreground size-7',
                refreshMs > 0 && 'text-primary hover:text-primary',
                isFetching && 'animate-spin'
              )}
              aria-label='Auto refresh'
            />
          }
        >
          <RefreshCw className='size-3.5' />
          {refreshMs > 0 && (
            <span className='ml-0.5 text-[10px] font-semibold'>
              {refreshLabel(refreshMs)}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent>
          {refreshMs === 0
            ? t('Auto refresh: Off. Click to enable.')
            : `${t('Auto refresh')}: ${refreshLabel(refreshMs)}`}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
