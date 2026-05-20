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
import { formatLogQuotaForOpsCenter } from '@/lib/ops-billing-display'
import { cn } from '@/lib/utils'
import {
  usageLogsStatBadgeClassName,
  usageLogsStatBadgeLabelClassName,
  usageLogsStatBadgeValueClassName,
} from '../lib/ops-ui-styles'
import { useIsAdmin } from '@/hooks/use-admin'
import { Skeleton } from '@/components/ui/skeleton'
import { getLogStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
import { buildApiParams } from '../lib/utils'
import { useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

function StatBadge(props: {
  label: string
  value: string | number
  hint?: string
  accent: string
}) {
  return (
    <span className={usageLogsStatBadgeClassName} title={props.hint}>
      <span className={cn('h-3.5 w-0.5 shrink-0 rounded-full', props.accent)} />
      <span className={usageLogsStatBadgeLabelClassName}>{props.label}</span>
      <span className={usageLogsStatBadgeValueClassName}>{props.value}</span>
    </span>
  )
}

export function CommonLogsStats() {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
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

  if (isLoading) {
    return (
      <div className='flex items-center gap-2'>
        <Skeleton className='h-8 w-[150px] rounded-md bg-white/10' />
        <Skeleton className='h-8 w-[100px] rounded-md bg-white/10' />
        <Skeleton className='h-8 w-[120px] rounded-md bg-white/10' />
      </div>
    )
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <StatBadge
        label={t('usageLogs.stats.quota_consumption')}
        value={
          sensitiveVisible
            ? formatLogQuotaForOpsCenter(stats?.quota || 0)
            : '••••'
        }
        accent='bg-sky-500/80'
      />
      <StatBadge
        label={t('RPM')}
        value={stats?.rpm || 0}
        hint={t('usageLogs.stats.rpm_hint')}
        accent='bg-rose-500/75'
      />
      <StatBadge
        label={t('TPM')}
        value={stats?.tpm || 0}
        hint={t('usageLogs.stats.tpm_hint')}
        accent='bg-slate-400/80'
      />
    </div>
  )
}
