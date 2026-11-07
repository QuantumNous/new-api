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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { requireServerSuccess } from '@/lib/server-error-message'
import { getStartOfDay } from '@/lib/time'

import {
  getAdminLogStat,
  getAdminQuotaRows,
  getAdminRegisteredUserTotal,
  getAdminUserQuotaRows,
} from './api'
import { ActiveUsersPanel } from './components/active-users-panel'
import { ModelUsagePanel } from './components/model-usage-panel'
import { OverviewStatCards } from './components/overview-stat-cards'
import { RevenuePanel } from './components/revenue-panel'
import { TokenUsagePanel } from './components/token-usage-panel'
import { TopModelsPanel } from './components/top-models-panel'
import {
  buildDailyRevenue,
  buildHourlyActiveUsers,
  buildModelUsage,
  buildMonthlyRevenue,
  buildTodayUsageSparkline,
  buildTodayTokenSeries,
  countActiveUsers,
  revenueYesterday,
  sumUsageSince,
} from './lib/aggregate'

const TREND_DAYS = 30
const TOP_MODEL_LIMIT = 6
const OVERVIEW_REFRESH_MS = 60 * 1000
const ALL_TIME_REFRESH_MS = 5 * 60 * 1000

export function AdminOverview() {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(new Date()),
      OVERVIEW_REFRESH_MS
    )
    return () => window.clearInterval(timer)
  }, [])
  const today = getStartOfDay(now)
  const todayStart = Math.floor(today.getTime() / 1000)
  const monthStart = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  )
  const trendDate = new Date(today)
  trendDate.setDate(trendDate.getDate() - (TREND_DAYS - 1))
  const trendStart = Math.floor(trendDate.getTime() / 1000)
  const windowStart = Math.floor(
    new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000
  )
  const currentHour = now.getHours()

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
    () => buildDailyRevenue(quotaRows, TREND_DAYS, now),
    [quotaRows, now]
  )
  const monthlyRevenueTrend = useMemo(
    () => buildMonthlyRevenue(quotaRows, 2, now),
    [quotaRows, now]
  )
  const revenueYesterdayValue = useMemo(
    () => revenueYesterday(revenueTrend),
    [revenueTrend]
  )
  const tokenSeries = useMemo(
    () => buildTodayTokenSeries(quotaRows, todayStart, currentHour),
    [quotaRows, todayStart, currentHour]
  )
  const modelUsage = useMemo(
    () =>
      buildModelUsage(quotaRows.filter((row) => row.created_at >= trendStart)),
    [quotaRows, trendStart]
  )
  const topModels = modelUsage.slice(0, TOP_MODEL_LIMIT)
  const totalModelTokens = modelUsage.reduce(
    (total, model) => total + model.tokens,
    0
  )
  const revenueSparkline = useMemo(
    () => buildTodayUsageSparkline(quotaRows, todayStart, currentHour, 'quota'),
    [quotaRows, todayStart, currentHour]
  )
  const requestsSparkline = useMemo(
    () => buildTodayUsageSparkline(quotaRows, todayStart, currentHour, 'count'),
    [quotaRows, todayStart, currentHour]
  )
  const activeUserCount = useMemo(
    () => countActiveUsers(activeRows),
    [activeRows]
  )
  const hourlyActivity = useMemo(
    () => buildHourlyActiveUsers(activeRows, now),
    [activeRows, now]
  )

  const registeredUsers = Number(registeredUsersQuery.data?.data?.total ?? 0)
  const allTimeRevenue =
    allTimeRevenueQuery.data?.data == null
      ? null
      : Number(allTimeRevenueQuery.data.data.quota ?? 0)
  const statsLoading =
    quotaQuery.isLoading ||
    activeUsersQuery.isLoading ||
    registeredUsersQuery.isLoading
  const queries = [
    quotaQuery,
    activeUsersQuery,
    allTimeRevenueQuery,
    registeredUsersQuery,
  ]
  const hasError = queries.some((query) => query.isError)
  const hasMissingData = queries.some(
    (query) => query.isError && query.data == null
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Home')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          {!hasError && (
            <span
              className='bg-success size-1.5 rounded-full'
              aria-hidden='true'
            />
          )}
          {hasError
            ? t('Failed to load')
            : t('Live data, refreshed every minute')}
        </span>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-3 sm:gap-4'>
          {hasError && (
            <Alert variant='destructive'>
              <AlertDescription className='flex flex-wrap items-center justify-between gap-2'>
                <span>{t('Failed to load')}</span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    for (const query of queries) {
                      if (query.isError) {
                        void query.refetch()
                      }
                    }
                  }}
                >
                  {t('Retry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {!hasMissingData && (
            <>
              <FadeIn>
                <OverviewStatCards
                  revenueToday={totalsToday.quota}
                  revenueMonth={totalsMonth.quota}
                  revenueYesterday={revenueYesterdayValue?.quota}
                  tokensToday={totalsToday.tokens}
                  requestsToday={totalsToday.requests}
                  activeUsers={activeUserCount}
                  registeredUsers={registeredUsers}
                  revenueSparkline={revenueSparkline}
                  requestsSparkline={requestsSparkline}
                  monthSparkline={revenueTrend.map((point) => point.quota)}
                  tokensSparkline={tokenSeries.points.map(
                    (point) => point.total
                  )}
                  loading={statsLoading}
                />
              </FadeIn>

              <div className='grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]'>
                <FadeIn delay={0.05}>
                  <RevenuePanel
                    points={revenueTrend}
                    monthlyPoints={monthlyRevenueTrend}
                    revenueToday={totalsToday.quota}
                    revenueMonth={totalsMonth.quota}
                    revenueAllTime={allTimeRevenue}
                    revenueYesterday={revenueYesterdayValue?.quota}
                    daysElapsed={now.getDate()}
                    loading={quotaQuery.isLoading}
                  />
                </FadeIn>
                <FadeIn delay={0.1}>
                  <ActiveUsersPanel
                    activeUsers={activeUserCount}
                    registeredUsers={registeredUsers}
                    points={hourlyActivity}
                    loading={
                      activeUsersQuery.isLoading ||
                      registeredUsersQuery.isLoading
                    }
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
                    totalTokens={totalModelTokens}
                    loading={quotaQuery.isLoading}
                  />
                </FadeIn>
              </div>
              <FadeIn delay={0.25}>
                <ModelUsagePanel
                  models={modelUsage}
                  loading={quotaQuery.isLoading}
                />
              </FadeIn>
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
