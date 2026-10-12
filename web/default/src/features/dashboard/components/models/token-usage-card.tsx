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
import { Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getTokenUsage } from '@/features/dashboard/api'
import { getDefaultDays } from '@/features/dashboard/lib'
import type { DashboardFilters } from '@/features/dashboard/types'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { computeTimeRange, formatDate } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

interface TokenUsageCardProps {
  filters: DashboardFilters
}

// Per-key spend table for the section's current time range and filters. The
// backend aggregates quota per (token_id, user_id) and ranks by spend; this
// card is the wallet view of the same data the stat cards read.
export function TokenUsageCard(props: TokenUsageCardProps) {
  const { t } = useTranslation()
  const userRole = useAuthStore((state) => state.auth.user?.role)
  const isAdmin = Boolean(userRole && userRole >= ROLE.ADMIN)

  const timeRange = useMemo(
    () =>
      computeTimeRange(
        getDefaultDays(props.filters?.time_granularity),
        props.filters?.start_timestamp,
        props.filters?.end_timestamp
      ),
    [
      props.filters?.time_granularity,
      props.filters?.start_timestamp,
      props.filters?.end_timestamp,
    ]
  )

  const query = useQuery({
    queryKey: [
      'dashboard',
      'token-usage',
      isAdmin,
      timeRange,
      props.filters?.username,
      props.filters?.token_name,
      props.filters?.model_name,
    ],
    queryFn: () =>
      getTokenUsage(
        {
          ...timeRange,
          ...(props.filters?.username && { username: props.filters.username }),
          ...(props.filters?.token_name && { token_name: props.filters.token_name }),
          ...(props.filters?.model_name && { model_name: props.filters.model_name }),
        },
        isAdmin
      ),
    select: (res) => (res.success ? (res.data ?? []) : []),
    staleTime: 60_000,
  })

  const rows = query.data ?? []
  const totalQuota = useMemo(
    () => rows.reduce((sum, row) => sum + (row.quota || 0), 0),
    [rows]
  )

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
        <IconBadge tone='info' size='sm'>
          <Wallet />
        </IconBadge>
        <div className='text-sm font-semibold'>{t('Key spend')}</div>
        {rows.length > 0 && (
          <div className='text-muted-foreground ml-auto text-sm'>
            <span className='mr-1'>{t('Total')}:</span>
            <span className='text-foreground font-semibold'>
              {formatQuota(totalQuota)}
            </span>
          </div>
        )}
      </div>

      {query.isLoading ? (
        <div className='space-y-2 p-3 sm:p-4'>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className='h-9 w-full' />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty className='py-8'>
          <EmptyHeader>
            <EmptyMedia>
              <Wallet />
            </EmptyMedia>
            <EmptyTitle>{t('No key spend in this range')}</EmptyTitle>
            <EmptyDescription>
              {t('Key spend appears once keys consume quota in the selected range')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='w-10 pl-3 sm:pl-5'>#</TableHead>
              <TableHead>{t('Key')}</TableHead>
              {isAdmin && <TableHead>{t('User')}</TableHead>}
              <TableHead className='text-right'>{t('Requests')}</TableHead>
              <TableHead className='text-right'>Tokens</TableHead>
              <TableHead className='text-right'>{t('Last used')}</TableHead>
              <TableHead className='pr-3 text-right sm:pr-5'>
                {t('Spend')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row.user_id}-${row.token_id}`}>
                <TableCell className='text-muted-foreground pl-3 tabular-nums sm:pl-5'>
                  {index + 1}
                </TableCell>
                <TableCell className='max-w-[220px] font-medium'>
                  <span className='block truncate' title={row.token_name}>
                    {row.token_name || `#${row.token_id}`}
                  </span>
                </TableCell>
                {isAdmin && (
                  <TableCell className='text-muted-foreground max-w-[140px]'>
                    <span className='block truncate' title={row.username}>
                      {row.username || '--'}
                    </span>
                  </TableCell>
                )}
                <TableCell className='text-right tabular-nums'>
                  {formatCompactNumber(row.count)}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {formatCompactNumber(row.token_used)}
                </TableCell>
                <TableCell className='text-muted-foreground text-right whitespace-nowrap tabular-nums'>
                  {row.last_used > 0 ? formatDate(row.last_used) : '--'}
                </TableCell>
                <TableCell className='pr-3 text-right font-semibold whitespace-nowrap tabular-nums sm:pr-5'>
                  {formatQuota(row.quota)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
