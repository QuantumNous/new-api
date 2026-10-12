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
import { Activity, Wallet } from 'lucide-react'
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
import {
  getSelfRealtimeKeyBreakdown,
  getTokenUsage,
} from '@/features/dashboard/api'
import { getDefaultDays } from '@/features/dashboard/lib'
import type { DashboardFilters } from '@/features/dashboard/types'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { computeTimeRange, formatDate } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

interface TokenUsageCardProps {
  filters: DashboardFilters
}

// realtimeRankingWindowSeconds picks which trailing window the "current
// consumption" ranking sorts by. 300s (5 minutes) is long enough to survive a
// gap between requests without going empty, short enough to still mean
// "right now" rather than "today".
const realtimeRankingWindowSeconds = 300

// How often the realtime ranking refetches. Matches the other realtime
// widgets on the dashboard so every current-traffic panel updates in step.
const realtimeRefetchIntervalMs = 10_000

// Per-key spend table plus a realtime "who is spending right now" ranking.
// The backend aggregates quota per (token_id, user_id) for the historical
// total, and splits the in-memory realtime rings per key for the live
// ranking — two different data sources because only quota_data remembers
// money, and only the rings know what is happening in the current window.
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

  const spendQuery = useQuery({
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

  // Realtime ranking is always "my own keys" — the breakdown comes from the
  // in-process rings scoped to the session user, so there is no admin/other
  // user variant the way the historical spend table has one.
  const realtimeQuery = useQuery({
    queryKey: ['dashboard', 'token-usage-realtime'],
    queryFn: () => getSelfRealtimeKeyBreakdown(),
    select: (res) => (res.success ? (res.data?.keys ?? []) : []),
    refetchInterval: realtimeRefetchIntervalMs,
    staleTime: 5_000,
  })

  const spendRows = spendQuery.data ?? []
  const totalQuota = useMemo(
    () => spendRows.reduce((sum, row) => sum + (row.quota || 0), 0),
    [spendRows]
  )

  const realtimeRows = useMemo(() => {
    const keys = realtimeQuery.data ?? []
    return keys
      .map((key) => {
        const window = key.windows.find(
          (w) => w.window_seconds === realtimeRankingWindowSeconds
        )
        return {
          token_id: key.token_id,
          token_name: key.token_name,
          requests: window?.requests ?? 0,
          tokens: window?.tokens ?? 0,
          rpm: window?.rpm ?? 0,
          tpm: window?.tpm ?? 0,
        }
      })
      .filter((row) => row.requests > 0 || row.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
  }, [realtimeQuery.data])

  return (
    <div className='space-y-4'>
      {/* Current consumption ranking: live, per key, from the realtime rings. */}
      <div className='overflow-hidden rounded-lg border'>
        <div className='flex items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
          <IconBadge tone='success' size='sm'>
            <Activity />
          </IconBadge>
          <div className='text-sm font-semibold'>{t('Current key consumption')}</div>
          <div className='text-muted-foreground ml-auto text-xs'>
            {t('Last 5 minutes')}
          </div>
        </div>

        {realtimeQuery.isLoading ? (
          <div className='space-y-2 p-3 sm:p-4'>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className='h-9 w-full' />
            ))}
          </div>
        ) : realtimeRows.length === 0 ? (
          <Empty className='py-8'>
            <EmptyHeader>
              <EmptyMedia>
                <Activity />
              </EmptyMedia>
              <EmptyTitle>{t('No active key traffic right now')}</EmptyTitle>
              <EmptyDescription>
                {t('Keys appear here once they serve a request in the last 5 minutes')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='w-10 pl-3 sm:pl-5'>#</TableHead>
                <TableHead>{t('Key')}</TableHead>
                <TableHead className='text-right'>{t('Requests')}</TableHead>
                <TableHead className='text-right'>Tokens</TableHead>
                <TableHead className='text-right'>RPM</TableHead>
                <TableHead className='pr-3 text-right sm:pr-5'>TPM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {realtimeRows.map((row, index) => (
                <TableRow key={row.token_id}>
                  <TableCell className='text-muted-foreground pl-3 tabular-nums sm:pl-5'>
                    {index + 1}
                  </TableCell>
                  <TableCell className='max-w-[220px] font-medium'>
                    <span className='block truncate' title={row.token_name}>
                      {row.token_name || `#${row.token_id}`}
                    </span>
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {formatCompactNumber(row.requests)}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {formatCompactNumber(row.tokens)}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {row.rpm.toFixed(1)}
                  </TableCell>
                  <TableCell className='pr-3 text-right tabular-nums sm:pr-5'>
                    {row.tpm.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Historical spend: the money total the realtime ring cannot report. */}
      <div className='overflow-hidden rounded-lg border'>
        <div className='flex items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
          <IconBadge tone='info' size='sm'>
            <Wallet />
          </IconBadge>
          <div className='text-sm font-semibold'>{t('Key spend')}</div>
          <div className='text-muted-foreground ml-auto text-sm'>
            <span className='mr-1'>{t('Total spend in range')}:</span>
            <span className='text-foreground text-base font-bold'>
              {formatQuota(totalQuota)}
            </span>
          </div>
        </div>

        {spendQuery.isLoading ? (
          <div className='space-y-2 p-3 sm:p-4'>
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className='h-9 w-full' />
            ))}
          </div>
        ) : spendRows.length === 0 ? (
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
              {spendRows.map((row, index) => (
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
    </div>
  )
}
