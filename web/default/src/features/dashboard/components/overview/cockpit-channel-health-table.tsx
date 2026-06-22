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
import { RadioTower } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { getChannels } from '@/features/channels/api'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import {
  OVERVIEW_LINK_CLASS,
  OVERVIEW_MIDDLE_BODY_CLASS,
  OVERVIEW_MIDDLE_SECTION_HEADER_CLASS,
  OVERVIEW_MIDDLE_SECTION_TITLE_CLASS,
  OVERVIEW_PRIMARY_BUTTON_CLASS,
  OVERVIEW_SECTION_CLASS,
  OVERVIEW_TABLE_HEAD_CLASS,
  OVERVIEW_TABLE_ROW_CLASS,
} from './overview-reference-styles'
import { OverviewEmptyState } from './overview-empty-state'

const TOP_LIMIT = 6
const MAX_LATENCY_MS = 3000

function statusFromRate(rate: number): {
  labelKey: string
  dotClass: string
  textClass: string
} {
  if (!Number.isFinite(rate)) {
    return {
      labelKey: 'Dashboard channel status unknown',
      dotClass: 'bg-slate-300',
      textClass: 'text-slate-500',
    }
  }
  if (rate >= 99) {
    return {
      labelKey: 'Dashboard channel status healthy',
      dotClass: 'bg-emerald-500',
      textClass: 'text-emerald-700',
    }
  }
  if (rate >= 95) {
    return {
      labelKey: 'Dashboard channel status warning',
      dotClass: 'bg-amber-500',
      textClass: 'text-amber-700',
    }
  }
  return {
    labelKey: 'Dashboard channel status critical',
    dotClass: 'bg-red-500',
    textClass: 'text-red-600',
  }
}

function channelHealthSegments(models: { success_rate: number }[]) {
  let healthy = 0
  let warning = 0
  let critical = 0
  for (const row of models) {
    const rate = Number(row.success_rate)
    if (!Number.isFinite(rate)) continue
    if (rate >= 99) healthy++
    else if (rate >= 95) warning++
    else critical++
  }
  return { healthy, warning, critical }
}

function ChannelHealthTableHead() {
  const { t } = useTranslation()

  return (
    <thead className={OVERVIEW_TABLE_HEAD_CLASS}>
      <tr>
        <th className='px-4 py-2 font-medium'>{t('Dashboard channel name column')}</th>
        <th className='px-2 py-2 font-medium'>{t('Status')}</th>
        <th className='px-2 py-2 text-right font-medium'>{t('Success rate')}</th>
        <th className='px-4 py-2 text-right font-medium'>
          {t('Dashboard response time column')}
        </th>
      </tr>
    </thead>
  )
}

export function CockpitChannelHealthTable() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)

  const metricsQuery = useQuery({
    queryKey: ['perf-metrics-summary', 24],
    queryFn: () => getPerfMetricsSummary(24),
    staleTime: 60 * 1000,
    retry: false,
    ...opsLiveDataQueryOptions,
  })

  const enabledChannelsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'enabled-channels-count'],
    queryFn: async () => {
      const response = await getChannels({
        status: 'enabled',
        p: 1,
        page_size: 1,
      })
      if (!response.success) {
        throw new Error(response.message || 'Failed to load channels')
      }
      return response
    },
    enabled: isAdmin,
    staleTime: 60 * 1000,
    ...opsLiveDataQueryOptions,
  })

  const rows = useMemo(
    () => (metricsQuery.data?.data.models ?? []).slice(0, TOP_LIMIT),
    [metricsQuery.data]
  )
  const segments = channelHealthSegments(metricsQuery.data?.data.models ?? [])
  const enabledCount =
    typeof enabledChannelsQuery.data?.data?.total === 'number'
      ? enabledChannelsQuery.data.data.total
      : null

  const loading = metricsQuery.isLoading || (isAdmin && enabledChannelsQuery.isLoading)
  const showEmptyBody = !loading && (metricsQuery.isError || rows.length === 0)

  return (
    <section className={cn(OVERVIEW_SECTION_CLASS, 'flex h-full flex-col')}>
      <div className={OVERVIEW_MIDDLE_SECTION_HEADER_CLASS}>
        <h3 className={OVERVIEW_MIDDLE_SECTION_TITLE_CLASS}>
          {t('Dashboard chart channel health')}
        </h3>
        <Link to='/channels' className={OVERVIEW_LINK_CLASS}>
          {t('More')} →
        </Link>
      </div>

      <div className={cn(OVERVIEW_MIDDLE_BODY_CLASS, 'flex flex-col overflow-hidden')}>
        {isAdmin && enabledCount !== null && !loading ? (
          <div className='flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-[#F0F2F5]/80 px-2 pb-1.5 pt-0.5 text-[11px] leading-snug'>
            <span className='text-[#374151]'>
              {t('Dashboard channel health enabled summary', {
                count: formatNumber(enabledCount),
              })}
            </span>
            <span className='text-[#16A34A]'>
              {t('Dashboard channel health healthy count', { count: segments.healthy })}
            </span>
            <span className='text-[#D97706]'>
              {t('Dashboard channel health warning count', { count: segments.warning })}
            </span>
            <span className='text-[#DC2626]'>
              {t('Dashboard channel health critical count', { count: segments.critical })}
            </span>
          </div>
        ) : null}

        <div className='min-h-0 flex-1 overflow-auto'>
        {loading ? (
          <div className='flex h-full flex-col justify-center gap-1.5 px-2'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-6 w-full rounded bg-slate-100' />
            ))}
          </div>
        ) : (
          <table className='w-full text-left text-[12px]'>
            {!showEmptyBody ? <ChannelHealthTableHead /> : null}
            <tbody>
              {showEmptyBody ? (
                <tr>
                  <td colSpan={4} className='p-0'>
                    <OverviewEmptyState
                      compact
                      icon={RadioTower}
                      title={
                        metricsQuery.isError
                          ? t('Dashboard perf metrics unavailable')
                          : t('Dashboard channel health empty hint')
                      }
                      description={
                        isAdmin && enabledCount !== null
                          ? t('Dashboard channel health empty enabled hint', {
                              count: formatNumber(enabledCount),
                            })
                          : t('Dashboard channel health empty goto hint')
                      }
                      action={
                        <Button
                          size='sm'
                          className={OVERVIEW_PRIMARY_BUTTON_CLASS}
                          render={<Link to='/channels' />}
                        >
                          {t('Dashboard view channels')}
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const status = statusFromRate(Number(row.success_rate))
                  const latencyMs = Number(row.avg_latency_ms) || 0
                  const latencyPct = Math.min(
                    100,
                    Math.round((latencyMs / MAX_LATENCY_MS) * 100)
                  )

                  return (
                    <tr key={row.model_name} className={OVERVIEW_TABLE_ROW_CLASS}>
                      <td className='max-w-[8rem] truncate px-4 py-2.5 font-medium text-[#111827]'>
                        {row.model_name}
                      </td>
                      <td className='px-2 py-2.5'>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-[13px] font-medium',
                            status.textClass
                          )}
                        >
                          <span
                            className={cn('size-1.5 rounded-full', status.dotClass)}
                            aria-hidden='true'
                          />
                          {t(status.labelKey)}
                        </span>
                      </td>
                      <td className='px-2 py-2.5 text-right font-mono tabular-nums text-[#111827]'>
                        {formatUptimePct(row.success_rate)}
                      </td>
                      <td className='px-4 py-2.5'>
                        <div className='flex items-center justify-end gap-2'>
                          <span className='font-mono text-[12px] tabular-nums text-[#374151]'>
                            {formatLatency(row.avg_latency_ms)}
                          </span>
                          <div className='hidden h-1.5 w-14 overflow-hidden rounded-full bg-[#F3F4F6] sm:block'>
                            <div
                              className={cn(
                                'h-full rounded-full',
                                latencyPct < 40 && 'bg-[#22C55E]',
                                latencyPct >= 40 &&
                                  latencyPct < 70 &&
                                  'bg-[#F59E0B]',
                                latencyPct >= 70 && 'bg-[#EF4444]'
                              )}
                              style={{ width: `${Math.max(latencyPct, 6)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
        </div>
      </div>
    </section>
  )
}
