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
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import {
  getCostReconciliation,
  getLogStats,
  getTeamLogStats,
  getUserLogStats,
} from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
import { formatUsageLogQuotaUSD, formatUsageLogUSDMicros } from '../lib/money'
import { buildApiParams } from '../lib/utils'
import { useLogsViewScope, useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

function StatBadge(props: {
  label: string
  value: string | number
  accent: string
}) {
  return (
    <span className='border-border/60 bg-muted/25 inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs shadow-xs'>
      <span className={cn('h-3.5 w-0.5 rounded-full', props.accent)} />
      <span className='text-muted-foreground'>{props.label}</span>
      <span className='text-foreground/85 font-mono font-semibold tabular-nums'>
        {props.value}
      </span>
    </span>
  )
}

export function CommonLogsStats() {
  const { t } = useTranslation()
  const { isAdminView: isAdmin, isTeamView } = useLogsViewScope()
  const searchParams = route.useSearch()
  const { sensitiveVisible } = useUsageLogsContext()
  const { status } = useStatus()

  const costQuery = useQuery({
    queryKey: ['usage-logs-cost-reconciliation', searchParams],
    enabled: isAdmin,
    queryFn: async () => {
      const toSeconds = (value: unknown) => {
        const timestamp = Number(value)
        return Number.isFinite(timestamp) && timestamp > 0
          ? Math.floor(timestamp / 1000)
          : undefined
      }
      const params: Record<string, unknown> = {
        start_timestamp: toSeconds(searchParams.startTime),
        end_timestamp: toSeconds(searchParams.endTime),
        keyword: searchParams.username || searchParams.keyword || undefined,
        token_name: searchParams.token || undefined,
        channel_id: searchParams.channel || undefined,
        group: searchParams.group || undefined,
      }
      return getCostReconciliation(params)
    },
  })

  const { data: stats, isLoading } = useQuery({
    queryKey: ['usage-logs-stats', isAdmin, isTeamView, searchParams],
    queryFn: async () => {
      const params = buildApiParams({
        page: 1,
        pageSize: 1,
        searchParams,
        columnFilters: [],
        isAdmin,
      })

      let result
      if (isAdmin) {
        result = await getLogStats(params)
      } else if (isTeamView) {
        result = await getTeamLogStats(params)
      } else {
        result = await getUserLogStats(params)
      }

      return result.success
        ? result.data || DEFAULT_LOG_STATS
        : DEFAULT_LOG_STATS
    },
    placeholderData: (previousData) => previousData,
  })

  if (isLoading) {
    return (
      <div className='flex items-center gap-2'>
        <Skeleton className='h-7 w-[150px] rounded-md' />
        <Skeleton className='h-7 w-[100px] rounded-md' />
        <Skeleton className='h-7 w-[120px] rounded-md' />
        <Skeleton className='h-7 w-[135px] rounded-md' />
      </div>
    )
  }

  const hasCacheStats = (stats?.cache_input_tokens || 0) > 0
  const cacheHitRate = hasCacheStats
    ? `${(stats?.cache_hit_rate || 0).toFixed(1)}%`
    : '-'
  const costTotals = costQuery.data?.data?.totals
  return (
    <div className='flex flex-wrap items-center gap-2'>
      {!isAdmin && (
        <StatBadge
          label={t('Usage')}
          value={
            sensitiveVisible
              ? formatUsageLogQuotaUSD(stats?.quota || 0, {
                  billingUSDToCNYRate: Number(
                    status?.billing_usd_to_cny_rate ?? 1
                  ),
                })
              : '••••'
          }
          accent='bg-sky-500/70'
        />
      )}
      <StatBadge
        label={t('RPM')}
        value={stats?.rpm || 0}
        accent='bg-rose-500/65'
      />
      <StatBadge
        label={t('TPM')}
        value={stats?.tpm || 0}
        accent='bg-slate-400/70'
      />
      <StatBadge
        label={t('Cache hit rate')}
        value={cacheHitRate}
        accent='bg-emerald-500/70'
      />
      {isAdmin && (
        <>
          <StatBadge
            label={t('Estimated cost')}
            value={formatUsageLogUSDMicros(
              costTotals?.estimated_cost_usd_micros
            )}
            accent='bg-amber-500/70'
          />
          <StatBadge
            label={t('User charge')}
            value={
              sensitiveVisible
                ? formatUsageLogUSDMicros(costTotals?.user_charge_usd_micros)
                : '••••'
            }
            accent='bg-cyan-500/70'
          />
          <StatBadge
            label={t('Retry')}
            value={formatUsageLogUSDMicros(costTotals?.retry_cost_usd_micros)}
            accent='bg-violet-500/70'
          />
          <StatBadge
            label={t('Estimate variance')}
            value={formatUsageLogUSDMicros(costTotals?.diff_usd_micros)}
            accent='bg-fuchsia-500/70'
          />
          <StatBadge
            label={t('Failed')}
            value={formatUsageLogUSDMicros(
              costTotals?.failed_partial_cost_usd_micros
            )}
            accent='bg-rose-500/70'
          />
          <StatBadge
            label={t('Unavailable')}
            value={costTotals?.unavailable_count || 0}
            accent='bg-slate-500/70'
          />
        </>
      )}
    </div>
  )
}
