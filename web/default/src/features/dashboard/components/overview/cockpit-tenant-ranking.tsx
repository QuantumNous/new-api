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
import { opsLiveDataQueryOptions } from '@/lib/query-polling'
import { Link } from '@tanstack/react-router'
import { Crown, Medal, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { getUserQuotaDataByUsers } from '@/features/dashboard/api'
import { useOpsRollingTimeRange } from '@/features/dashboard/hooks/use-ops-rolling-time-range'
import {
  OVERVIEW_BOTTOM_PANEL_BODY_CLASS,
  OVERVIEW_BOTTOM_SECTION_HEADER_CLASS,
  OVERVIEW_LINK_CLASS,
  OVERVIEW_PRIMARY_BUTTON_CLASS,
  OVERVIEW_SECTION_CLASS,
  OVERVIEW_SECTION_TITLE_CLASS,
  OVERVIEW_TABLE_HEAD_CLASS,
  OVERVIEW_TABLE_ROW_CLASS,
} from './overview-reference-styles'
import { OverviewEmptyState } from './overview-empty-state'

const TOP_LIMIT = 5

function RankBadge(props: { rank: number }) {
  if (props.rank === 1) {
    return <Crown className='size-4 text-amber-500' aria-hidden='true' />
  }
  if (props.rank === 2) {
    return <Medal className='size-4 text-slate-400' aria-hidden='true' />
  }
  if (props.rank === 3) {
    return <Medal className='size-4 text-orange-400' aria-hidden='true' />
  }
  return (
    <span className='inline-flex size-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600'>
      {props.rank}
    </span>
  )
}

export function CockpitTenantRanking() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)
  const summaryTimeRange = useOpsRollingTimeRange(1)

  const activeAccountsQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'active-accounts',
      summaryTimeRange.start_timestamp,
      summaryTimeRange.end_timestamp,
    ],
    queryFn: async () => {
      const response = await getUserQuotaDataByUsers({
        start_timestamp: summaryTimeRange.start_timestamp,
        end_timestamp: summaryTimeRange.end_timestamp,
      })
      if (!response.success) {
        throw new Error('Failed to load tenant ranking')
      }
      return response
    },
    enabled: isAdmin,
    staleTime: 60 * 1000,
    ...opsLiveDataQueryOptions,
  })

  const { ranked, totalCalls } = useMemo(() => {
    const rows = activeAccountsQuery.data?.data ?? []
    const sorted = [...rows].sort(
      (a, b) => (Number(b.count) || 0) - (Number(a.count) || 0)
    )
    const top = sorted.slice(0, TOP_LIMIT)
    const total = sorted.reduce(
      (sum, row) => sum + (Number(row.count) || 0),
      0
    )
    return {
      totalCalls: total,
      ranked: top.map((row, index) => {
        const calls = Number(row.count) || 0
        return {
          rank: index + 1,
          name: row.username || row.user_id?.toString() || t('Unknown'),
          calls,
          share: total > 0 ? (calls / total) * 100 : 0,
        }
      }),
    }
  }, [activeAccountsQuery.data?.data, t])

  const loading = isAdmin && activeAccountsQuery.isLoading
  const showEmpty = !loading && (!isAdmin || ranked.length === 0)

  return (
    <section className={cn(OVERVIEW_SECTION_CLASS, 'flex h-full flex-col')}>
      <div className={OVERVIEW_BOTTOM_SECTION_HEADER_CLASS}>
        <h3 className={OVERVIEW_SECTION_TITLE_CLASS}>
          {t('Dashboard chart tenant ranking calls')}
        </h3>
        <Link
          to='/dashboard/$section'
          params={{ section: 'users' }}
          className={OVERVIEW_LINK_CLASS}
        >
          {t('More')} →
        </Link>
      </div>

      <div className={cn(OVERVIEW_BOTTOM_PANEL_BODY_CLASS, 'overflow-x-auto')}>
        {loading ? (
          <div className='flex h-full flex-col justify-center gap-1.5 px-3 py-2'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-7 w-full rounded bg-slate-100' />
            ))}
          </div>
        ) : (
          <table className='w-full min-w-[20rem] text-left text-[13px]'>
            {!showEmpty ? (
              <thead className={OVERVIEW_TABLE_HEAD_CLASS}>
                <tr>
                  <th className='w-14 px-4 py-2 font-medium'>{t('Rank')}</th>
                  <th className='px-2 py-2 font-medium'>{t('Tenant')}</th>
                  <th className='px-2 py-2 text-right font-medium'>{t('Calls')}</th>
                  <th className='min-w-[7rem] px-4 py-2 font-medium'>{t('Share')}</th>
                </tr>
              </thead>
            ) : null}
            <tbody>
              {showEmpty ? (
                <tr>
                  <td colSpan={4} className='p-0'>
                    <OverviewEmptyState
                      compact
                      icon={Trophy}
                      title={t('Dashboard tenant ranking empty title')}
                      description={
                        isAdmin
                          ? t('Dashboard tenant ranking empty hint')
                          : t('Dashboard tenant ranking admin only hint')
                      }
                      action={
                        isAdmin ? (
                          <Button
                            size='sm'
                            className={OVERVIEW_PRIMARY_BUTTON_CLASS}
                            render={<Link to='/users' />}
                          >
                            {t('Dashboard view tenant accounts')}
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                ranked.map((row) => (
                  <tr
                    key={`${row.name}-${row.rank}`}
                    className={OVERVIEW_TABLE_ROW_CLASS}
                  >
                    <td className='px-4 py-2.5'>
                      <RankBadge rank={row.rank} />
                    </td>
                    <td className='max-w-[8rem] truncate px-2 py-2.5 font-medium text-[#111827]'>
                      {row.name}
                    </td>
                    <td className='px-2 py-2.5 text-right font-mono font-semibold tabular-nums text-[#111827]'>
                      {formatNumber(row.calls)}
                    </td>
                    <td className='px-4 py-2.5'>
                      <div className='flex items-center gap-2'>
                        <div className='h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#F3F4F6]'>
                          <div
                            className='h-full rounded-full bg-[#2563EB]'
                            style={{
                              width: `${Math.max(row.share, totalCalls > 0 ? 4 : 0)}%`,
                            }}
                          />
                        </div>
                        <span className='w-10 shrink-0 text-right font-mono text-[12px] tabular-nums text-[#6B7280]'>
                          {row.share.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
