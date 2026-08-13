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
import { formatCNYAmount } from '@/lib/currency'
import { formatLogQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import { getLogStats, getUpstreamCostStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
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
  const { isAdminView: isAdmin } = useLogsViewScope()
  const searchParams = route.useSearch()
  const { sensitiveVisible } = useUsageLogsContext()

  const { data: stats, isLoading } = useQuery({
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

      return result.success
        ? result.data || DEFAULT_LOG_STATS
        : DEFAULT_LOG_STATS
    },
    placeholderData: (previousData) => previousData,
  })
  const { data: upstreamCostStats, isLoading: isUpstreamCostLoading } =
    useQuery({
      queryKey: ['usage-logs-upstream-cost-stats', searchParams],
      queryFn: async () => {
        const params = buildApiParams({
          page: 1,
          pageSize: 1,
          searchParams,
          columnFilters: [],
          isAdmin: true,
        })
        const result = await getUpstreamCostStats(params)
        return result.success ? result.data : undefined
      },
      enabled: isAdmin,
      placeholderData: (previousData) => previousData,
    })

  if (isLoading || (isAdmin && isUpstreamCostLoading)) {
    return (
      <div className='flex items-center gap-2'>
        <Skeleton className='h-7 w-[150px] rounded-md' />
        <Skeleton className='h-7 w-[100px] rounded-md' />
        <Skeleton className='h-7 w-[120px] rounded-md' />
        {isAdmin && <Skeleton className='h-7 w-[160px] rounded-md' />}
      </div>
    )
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <StatBadge
        label={t('Usage')}
        value={sensitiveVisible ? formatLogQuota(stats?.quota || 0) : '••••'}
        accent='bg-sky-500/70'
      />
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
      {isAdmin && (
        <>
          <StatBadge
            label={t('Upstream Cost')}
            value={
              sensitiveVisible
                ? formatCNYAmount(
                    (upstreamCostStats?.amount_cny_micros || 0) / 1_000_000,
                    {
                      digitsLarge: 4,
                      digitsSmall: 6,
                      abbreviate: false,
                    }
                  )
                : '••••'
            }
            accent='bg-emerald-500/70'
          />
          <StatBadge
            label={t('Unpriced')}
            value={`${upstreamCostStats?.unpriced_requests || 0}/${(upstreamCostStats?.settled_requests || 0) + (upstreamCostStats?.unpriced_requests || 0)}`}
            accent={
              upstreamCostStats?.unpriced_requests
                ? 'bg-amber-500/80'
                : 'bg-slate-300/70'
            }
          />
        </>
      )}
    </div>
  )
}
