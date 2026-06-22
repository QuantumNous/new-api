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
import { AlertCircle, TrendingUp, UserPlus, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { useOpsRollingTimeRange } from '@/features/dashboard/hooks/use-ops-rolling-time-range'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { formatQuotaForCockpit } from './cockpit-display'
import {
  OVERVIEW_BOTTOM_PANEL_BODY_CLASS,
  OVERVIEW_BOTTOM_SECTION_HEADER_CLASS,
  OVERVIEW_SECTION_CLASS,
  OVERVIEW_SECTION_TITLE_CLASS,
} from './overview-reference-styles'

function peakWithTime(
  data: QuotaDataItem[],
  field: 'count' | 'quota'
): { value: number; timeLabel: string | null } {
  let peak = 0
  let peakTs = 0
  for (const item of data) {
    const value = Number(field === 'count' ? item.count : item.quota) || 0
    const ts = Number(item.created_at) || 0
    if (value >= peak) {
      peak = value
      peakTs = ts
    }
  }
  if (peak <= 0 || peakTs <= 0) return { value: 0, timeLabel: null }
  const date = new Date(peakTs * 1000)
  const timeLabel = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return { value: peak, timeLabel }
}

export function Cockpit24hOverview() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)
  const summaryTimeRange = useOpsRollingTimeRange(1)

  const usageTrendQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'summary-sparklines',
      isAdmin,
      summaryTimeRange.start_timestamp,
      summaryTimeRange.end_timestamp,
    ],
    queryFn: async () =>
      getUserQuotaDates(
        {
          start_timestamp: summaryTimeRange.start_timestamp,
          end_timestamp: summaryTimeRange.end_timestamp,
          default_time: 'hour',
        },
        isAdmin
      ),
    staleTime: 60 * 1000,
    ...opsLiveDataQueryOptions,
  })

  const items = usageTrendQuery.data?.data ?? []
  const stats = useMemo(() => {
    return {
      peakCalls: peakWithTime(items, 'count'),
      peakTokens: peakWithTime(items, 'quota'),
    }
  }, [items])

  const loading = usageTrendQuery.isLoading

  const metrics = [
    {
      key: 'peak-calls',
      icon: Zap,
      iconClass: 'text-[#2563EB] bg-[#EFF6FF]',
      label: t('Dashboard 24h peak calls'),
      value: formatNumber(stats.peakCalls.value),
      unit: t('Dashboard 24h per minute suffix'),
      sub: stats.peakCalls.timeLabel
        ? t('Dashboard 24h occurred at', { time: stats.peakCalls.timeLabel })
        : t('Dashboard 24h no peak yet'),
    },
    {
      key: 'peak-tokens',
      icon: TrendingUp,
      iconClass: 'text-[#7C3AED] bg-[#F5F3FF]',
      label: t('Dashboard 24h peak tokens'),
      value: formatQuotaForCockpit(stats.peakTokens.value),
      sub: stats.peakTokens.timeLabel
        ? t('Dashboard 24h occurred at', { time: stats.peakTokens.timeLabel })
        : t('Dashboard 24h no peak yet'),
    },
    {
      key: 'failed',
      icon: AlertCircle,
      iconClass: 'text-[#D97706] bg-[#FFFBEB]',
      label: t('Dashboard 24h failed requests'),
      value: '0',
      sub: t('Dashboard 24h failed requests hint'),
      link: '/usage-logs/$section' as const,
      linkParams: { section: 'common' as const },
    },
    {
      key: 'new-users',
      icon: UserPlus,
      iconClass: 'text-[#16A34A] bg-[#ECFDF5]',
      label: t('Dashboard 24h new accounts'),
      value: '0',
      sub: t('Dashboard 24h new accounts hint'),
      link: isAdmin ? ('/users' as const) : undefined,
      linkParams: undefined,
    },
  ]

  return (
    <section className={cn(OVERVIEW_SECTION_CLASS, 'flex h-full flex-col')}>
      <div className={OVERVIEW_BOTTOM_SECTION_HEADER_CLASS}>
        <h3 className={OVERVIEW_SECTION_TITLE_CLASS}>
          {t('Dashboard 24h overview title')}
        </h3>
      </div>

      <div
        className={cn(
          OVERVIEW_BOTTOM_PANEL_BODY_CLASS,
          'grid grid-cols-2 divide-x divide-[#F0F2F5] lg:grid-cols-4'
        )}
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='flex items-center p-3'>
                <Skeleton className='h-14 w-full rounded-lg bg-slate-100' />
              </div>
            ))
          : metrics.map((metric) => {
              const Icon = metric.icon
              const content = (
                <div className='flex h-full flex-col justify-center gap-1.5 p-3'>
                  <div className='flex items-center gap-1.5'>
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md',
                        metric.iconClass
                      )}
                    >
                      <Icon className='size-3.5' aria-hidden='true' />
                    </span>
                    <p className='truncate text-[12px] font-medium text-[#6B7280]'>
                      {metric.label}
                    </p>
                  </div>
                  <div className='flex items-baseline gap-1'>
                    <p className='font-[DIN,sans-serif] text-[20px] font-bold leading-none text-[#111827]'>
                      {metric.value}
                    </p>
                    {'unit' in metric && metric.unit ? (
                      <span className='text-[12px] text-[#9CA3AF]'>
                        / {metric.unit}
                      </span>
                    ) : null}
                  </div>
                  <p className='line-clamp-2 text-[11px] leading-snug text-[#9CA3AF]'>
                    {metric.sub}
                  </p>
                </div>
              )

              if (metric.link) {
                return (
                  <Link
                    key={metric.key}
                    to={metric.link}
                    params={metric.linkParams}
                    className='block transition-colors hover:bg-[#F8FAFC]'
                  >
                    {content}
                  </Link>
                )
              }

              return <div key={metric.key}>{content}</div>
            })}
      </div>
    </section>
  )
}
