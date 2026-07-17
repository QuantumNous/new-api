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

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuotaWithCurrency } from '@/lib/currency'

import { getLogStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
import { buildApiParams } from '../lib/utils'
import { useLogsViewScope, useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

function StatBadge(props: {
  label: string
  tone: 'usage' | 'rpm' | 'tpm'
  value: string | number
}) {
  let labelClassName = 'text-foreground'
  if (props.tone === 'usage') {
    labelClassName = 'text-status-info'
  } else if (props.tone === 'rpm') {
    labelClassName = 'text-metric-rpm'
  }

  return (
    <Badge variant='outline' className='h-6 gap-2'>
      <span className={labelClassName}>{props.label}</span>
      <span className='text-foreground/85 font-semibold tabular-nums'>
        {props.value}
      </span>
    </Badge>
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

  // Mirrors the loaded stat badges below: same wrapping row, and pill widths
  // matching the typical rendered size of "Usage ¥…", "RPM n", "TPM n" so the
  // row stays on one line on phones (~304px incl. gaps) without layout shift.
  if (isLoading) {
    return (
      <div className='flex flex-wrap items-center gap-2'>
        <Skeleton className='h-6 w-28 rounded-full' />
        <Skeleton className='h-6 w-20 rounded-full' />
        <Skeleton className='h-6 w-24 rounded-full' />
      </div>
    )
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <StatBadge
        label={t('Usage')}
        tone='usage'
        value={
          sensitiveVisible
            ? formatQuotaWithCurrency(stats?.quota || 0, {
                digitsLarge: 2,
                digitsSmall: 6,
                abbreviate: false,
              })
            : '••••'
        }
      />
      <StatBadge label={t('RPM')} tone='rpm' value={stats?.rpm || 0} />
      <StatBadge label={t('TPM')} tone='tpm' value={stats?.tpm || 0} />
    </div>
  )
}
