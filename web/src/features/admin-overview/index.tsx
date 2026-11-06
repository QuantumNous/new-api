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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { requireServerSuccess } from '@/lib/server-error-message'
import { getStartOfDay } from '@/lib/time'

import {
  getAdminLogStat,
  getAdminQuotaRows,
  getAdminRegisteredUserTotal,
  getAdminUserQuotaRows,
} from './api'
import { ActiveUsersPanel } from './components/active-users-panel'
import { OverviewStatCards } from './components/overview-stat-cards'
import { RevenuePanel } from './components/revenue-panel'
import { TokenUsagePanel } from './components/token-usage-panel'
import { TopModelsPanel } from './components/top-models-panel'
import {
  buildDailyRevenue,
  buildHourlyActiveUsers,
  buildModelUsage,
  buildTodayQuotaSparkline,
  buildTodayTokenSeries,
  countActiveUsers,
  sumUsageSince,
} from './lib/aggregate'

const TREND_DAYS = 30
const TOP_MODEL_LIMIT = 6
const OVERVIEW_REFRESH_MS = 60 * 1000
const ALL_TIME_REFRESH_MS = 5 * 60 * 1000

export function AdminOverview() {
  const { t } = useTranslation()
  const todayStart = useMemo(
    () => Math.floor(getStartOfDay().getTime() / 1000),
    []
  )
  const monthStart = useMemo(() => {
    const now = new Date()
    return Math.floor(
      new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
    )
  }, [])
  const trendStart = useMemo(() => {
    const start = getStartOfDay()
    start.setDate(start.getDate() - (TREND_DAYS - 1))
    return Math.floor(start.getTime() / 1000)
  }, [])
  // Keep the whole current month inside the window even at month end, when
  // the rolling 30-day range starts after the 1st.
  const windowStart = Math.min(trendStart, monthStart)
  const currentHour = new Date().getHours()

  const quotaQuery = useQuery({
    queryKey: ['admin-overview', 'quota', windowStart],
    queryFn: async () =>
      requireServerSuccess(
        await getAdminQuotaRows({
          start_timestamp: windowStart,
          // Include the current hour even when the export lags behind.
          end_timestamp: Math.floor(Date.now() / 1000) + 3600,
        })
      ),
    refetchInterval: OVERVIEW_REFRESH_MS,
    staleTime: OVERVIEW_REFRESH_MS - 5000,
  })

  const activeUsersQuery = useQuery({
    queryKey: ['admin-overview', 'active-users'],
    queryFn: async () => {
      const now = Math.floor(Date.now() / 1000)
      return requireServerSuccess(
        await getAdminUserQuotaRows({
          start_timestamp: now - 24 * 3600,
          end_timestamp: now + 3600,
        })
      )
    },
    refetchInterval: OVERVIEW_REFRESH_MS,
    staleTime: OVERVIEW_REFRESH_MS - 5000,
  })

  const allTimeRevenueQuery = useQuery({
    queryKey: ['admin-overview', 'all-time-revenue'],
    queryFn: async () =>
      requireServerSuccess(
        await getAdminLogStat({
          end_timestamp: Math.floor(Date.now() / 1000),
        })
      ),
    refetchInterval: ALL_TIME_REFRESH_MS,
    staleTime: ALL_TIME_REFRESH_MS,
  })

  const registeredUsersQuery = useQuery({
    queryKey: ['admin-overview', 'registered-users'],
    queryFn: async () =>
      requireServerSuccess(await getAdminRegisteredUserTotal()),
    staleTime: ALL_TIME_REFRESH_MS,
  })

  const quotaRows = useMemo(
    () => quotaQuery.data?.data ?? [],
    [quotaQuery.data]
  )
  const activeRows = useMemo(
    () => activeUsersQuery.data?.data ?? [],
    [activeUsersQuery.data]
  )

  const totalsToday = useMemo(
    () => sumUsageSince(quotaRows, todayStart),
    [quotaRows, todayStart]
  )
  const totalsMonth = useMemo(
    () => sumUsageSince(quotaRows, monthStart),
    [quotaRows, monthStart]
  )
  const revenueTrend = useMemo(
    () => buildDailyRevenue(quotaRows, TREND_DAYS),
    [quotaRows]
  )
  const tokenSeries = useMemo(
    () => buildTodayTokenSeries(quotaRows, todayStart, currentHour),
    [quotaRows, todayStart, currentHour]
  )
  const topModels = useMemo(
    () => buildModelUsage(quotaRows).slice(0, TOP_MODEL_LIMIT),
    [quotaRows]
  )
  const revenueSparkline = useMemo(
    () => buildTodayQuotaSparkline(quotaRows, todayStart, currentHour),
    [quotaRows, todayStart, currentHour]
  )
  const activeUserCount = useMemo(
    () => countActiveUsers(activeRows),
    [activeRows]
  )
  const hourlyActivity = useMemo(
    () => buildHourlyActiveUsers(activeRows),
    [activeRows]
  )

  const registeredUsers = Number(registeredUsersQuery.data?.data?.total ?? 0)
  const allTimeRevenue =
    allTimeRevenueQuery.data?.data == null
      ? null
      : Number(allTimeRevenueQuery.data.data.quota ?? 0)
  const statsLoading = quotaQuery.isLoading || activeUsersQuery.isLoading

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Home')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          <span
            className='bg-success size-1.5 rounded-full'
            aria-hidden='true'
          />
          {t('Live data, refreshed every minute')}
        </span>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-3 sm:gap-4'>
          <FadeIn>
            <OverviewStatCards
              revenueToday={totalsToday.quota}
              revenueMonth={totalsMonth.quota}
              tokensToday={totalsToday.tokens}
              requestsToday={totalsToday.requests}
              activeUsers={activeUserCount}
              registeredUsers={registeredUsers}
              revenueSparkline={revenueSparkline}
              monthSparkline={revenueTrend.map((point) => point.quota)}
              tokensSparkline={tokenSeries.points.map((point) => point.total)}
              loading={statsLoading}
            />
          </FadeIn>

          <div className='grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]'>
            <FadeIn delay={0.05}>
              <RevenuePanel
                points={revenueTrend}
                revenueToday={totalsToday.quota}
                revenueMonth={totalsMonth.quota}
                revenueAllTime={allTimeRevenue}
                loading={quotaQuery.isLoading}
              />
            </FadeIn>
            <FadeIn delay={0.1}>
              <ActiveUsersPanel
                activeUsers={activeUserCount}
                registeredUsers={registeredUsers}
                points={hourlyActivity}
                loading={activeUsersQuery.isLoading}
              />
            </FadeIn>
          </div>

          <div className='grid gap-3 sm:gap-4 xl:grid-cols-2'>
            <FadeIn delay={0.15}>
              <TokenUsagePanel
                series={tokenSeries.series}
                points={tokenSeries.points}
                tokensToday={totalsToday.tokens}
                requestsToday={totalsToday.requests}
                loading={quotaQuery.isLoading}
              />
            </FadeIn>
            <FadeIn delay={0.2}>
              <TopModelsPanel
                models={topModels}
                loading={quotaQuery.isLoading}
              />
            </FadeIn>
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
