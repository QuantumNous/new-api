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
import {
  Activity,
  ArrowRight,
  Building2,
  Coins,
  RadioTower,
  ShieldCheck,
  Timer,
  TrendingDown,
  Flame,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { formatNumber } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
import { Button } from '@/components/ui/button'
import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { getChannels } from '@/features/channels/api'
import {
  getUserQuotaDataByUsers,
  getUserQuotaDates,
} from '@/features/dashboard/api'
import {
  countActiveAccountsFromQuotaData,
  isAccountActiveInQuotaData,
} from '@/features/dashboard/lib/stats'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import { StatCard } from '../ui/stat-card'
import {
  COCKPIT_BALANCE_PANEL_CLASS,
  COCKPIT_INSET_SURFACE_CLASS,
  COCKPIT_SECTION_CLASS,
  COCKPIT_STAT_CARD_CLASS,
  formatQuotaForCockpit,
} from './cockpit-display'

const PERFORMANCE_WINDOW_HOURS = 24
const SUMMARY_SPARKLINE_BUCKETS = 12

type SummarySparklineKey = 'balance' | 'usage' | 'requests'

type HealthLevel = 'healthy' | 'caution' | 'critical'

function getBucketIndex(
  timestamp: number,
  start: number,
  end: number,
  bucketCount: number
): number {
  if (end <= start) return 0
  const ratio = (timestamp - start) / (end - start)
  return Math.min(bucketCount - 1, Math.max(0, Math.floor(ratio * bucketCount)))
}

function buildSummarySparklines(
  data: QuotaDataItem[],
  currentBalance: number,
  start: number,
  end: number
): Record<SummarySparklineKey, number[]> {
  const usage = Array.from({ length: SUMMARY_SPARKLINE_BUCKETS }, () => 0)
  const requests = Array.from({ length: SUMMARY_SPARKLINE_BUCKETS }, () => 0)

  for (const item of data) {
    const timestamp = Number(item.created_at) || start
    const index = getBucketIndex(
      timestamp,
      start,
      end,
      SUMMARY_SPARKLINE_BUCKETS
    )
    usage[index] += Number(item.quota) || 0
    requests[index] += Number(item.count) || 0
  }

  let balance = currentBalance
  const balanceTrend = Array.from(
    { length: SUMMARY_SPARKLINE_BUCKETS },
    () => 0
  )

  for (let index = SUMMARY_SPARKLINE_BUCKETS - 1; index >= 0; index--) {
    balanceTrend[index] = Math.max(0, balance)
    balance += usage[index]
  }

  return { balance: balanceTrend, usage, requests }
}

function getRunwayDays(remainQuota: number, recentUsage: number): number | null {
  if (remainQuota <= 0 || recentUsage <= 0) return null
  const days = remainQuota / recentUsage
  if (!Number.isFinite(days)) return null
  return days
}

function getHealthLevel(
  remainQuota: number,
  recentUsage: number
): HealthLevel {
  if (remainQuota <= 0) return 'critical'
  const days = getRunwayDays(remainQuota, recentUsage)
  if (days !== null && days < 3) return 'caution'
  return 'healthy'
}

const HEALTH_CONFIG: Record<
  HealthLevel,
  { dotClass: string; labelKey: string }
> = {
  healthy: { dotClass: 'bg-emerald-500', labelKey: 'Dashboard health healthy' },
  caution: { dotClass: 'bg-amber-500', labelKey: 'Dashboard health caution' },
  critical: { dotClass: 'bg-red-500', labelKey: 'Dashboard health critical' },
}

function simpleAverageSuccessRate(
  rows: { success_rate: number }[]
): number {
  let total = 0
  let count = 0
  for (const row of rows) {
    const value = Number(row.success_rate)
    if (!Number.isFinite(value)) continue
    total += value
    count++
  }
  return count > 0 ? total / count : NaN
}

function simpleAverageLatency(rows: { avg_latency_ms: number }[]): number {
  let total = 0
  let count = 0
  for (const row of rows) {
    const value = Number(row.avg_latency_ms)
    if (!Number.isFinite(value) || value <= 0) continue
    total += value
    count++
  }
  return count > 0 ? Math.round(total / count) : NaN
}

export function SummaryCards() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { loading: statusLoading } = useStatus()
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)

  const summaryTimeRange = useMemo(() => computeTimeRange(1), [])

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
        throw new Error('Failed to load active account stats')
      }
      return response
    },
    enabled: isAdmin,
    staleTime: 60 * 1000,
    ...opsLiveDataQueryOptions,
  })
  const remainQuota = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)

  const usageTrendQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'summary-sparklines',
      summaryTimeRange.start_timestamp,
      summaryTimeRange.end_timestamp,
    ],
    queryFn: async () =>
      getUserQuotaDates({
        start_timestamp: summaryTimeRange.start_timestamp,
        end_timestamp: summaryTimeRange.end_timestamp,
        default_time: 'hour',
      }),
    staleTime: 60 * 1000,
    ...opsLiveDataQueryOptions,
  })

  const metricsQuery = useQuery({
    queryKey: ['perf-metrics-summary', PERFORMANCE_WINDOW_HOURS],
    queryFn: () => getPerfMetricsSummary(PERFORMANCE_WINDOW_HOURS),
    staleTime: 60 * 1000,
    retry: false,
    ...opsLiveDataQueryOptions,
  })

  const perfModels = metricsQuery.data?.data.models ?? []

  const sparklineData = useMemo(
    () =>
      buildSummarySparklines(
        usageTrendQuery.data?.data ?? [],
        remainQuota,
        summaryTimeRange.start_timestamp,
        summaryTimeRange.end_timestamp
      ),
    [
      remainQuota,
      summaryTimeRange.end_timestamp,
      summaryTimeRange.start_timestamp,
      usageTrendQuery.data?.data,
    ]
  )

  const recentCalls = useMemo(
    () =>
      (usageTrendQuery.data?.data ?? []).reduce(
        (total, item) => total + (Number(item.count) || 0),
        0
      ),
    [usageTrendQuery.data?.data]
  )

  const recentUsage = useMemo(
    () =>
      (usageTrendQuery.data?.data ?? []).reduce(
        (total, item) => total + (Number(item.quota) || 0),
        0
      ),
    [usageTrendQuery.data?.data]
  )

  const healthLevel = getHealthLevel(remainQuota, recentUsage)
  const healthCfg = HEALTH_CONFIG[healthLevel]
  const runwayDays = getRunwayDays(remainQuota, recentUsage)

  const kpiLoading = usageTrendQuery.isLoading || statusLoading

  const successRate = simpleAverageSuccessRate(perfModels)
  const avgLatencyMs = simpleAverageLatency(perfModels)

  const selfQuotaItems = usageTrendQuery.data?.data ?? []
  const selfActiveAccountValue = usageTrendQuery.isSuccess
    ? isAccountActiveInQuotaData(selfQuotaItems)
      ? '1'
      : '0'
    : '—'

  const adminActiveAccountCount = countActiveAccountsFromQuotaData(
    activeAccountsQuery.data?.data ?? []
  )
  const adminActiveAccountValue = activeAccountsQuery.isSuccess
    ? formatNumber(adminActiveAccountCount)
    : '—'

  const adminEnabledChannelsTotal = enabledChannelsQuery.data?.data?.total
  const adminChannelsValue = enabledChannelsQuery.isSuccess
    ? formatNumber(
        typeof adminEnabledChannelsTotal === 'number'
          ? adminEnabledChannelsTotal
          : 0
      )
    : '—'

  const kpiItems = [
    {
      key: 'calls',
      title: t('Dashboard KPI calls today'),
      value: formatNumber(recentCalls),
      description: t('Dashboard KPI window 24h'),
      icon: Activity,
      tone: 'teal' as const,
      sparkline: sparklineData.requests,
    },
    {
      key: 'tokens',
      title: t('Dashboard KPI tokens today'),
      value: formatQuotaForCockpit(recentUsage),
      description: t('Dashboard KPI tokens description'),
      icon: Coins,
      tone: 'rose' as const,
      sparkline: sparklineData.usage,
    },
    {
      key: 'accounts',
      title: t('Dashboard KPI active accounts'),
      value: isAdmin ? adminActiveAccountValue : selfActiveAccountValue,
      description: isAdmin
        ? t('Dashboard KPI active accounts admin hint')
        : t('Dashboard KPI active accounts self hint'),
      icon: Building2,
      tone: 'gray' as const,
      loading: isAdmin
        ? activeAccountsQuery.isLoading
        : usageTrendQuery.isLoading,
    },
    {
      key: 'channels',
      title: t('Dashboard KPI model channels'),
      value: isAdmin ? adminChannelsValue : '—',
      description: isAdmin
        ? enabledChannelsQuery.isSuccess
          ? t('Dashboard KPI channels enabled hint')
          : enabledChannelsQuery.isError
            ? t('Dashboard KPI channels load failed hint')
            : t('Dashboard KPI channels placeholder hint')
        : t('Dashboard KPI channels admin only hint'),
      icon: RadioTower,
      tone: 'gray' as const,
      loading: isAdmin ? enabledChannelsQuery.isLoading : false,
    },
    {
      key: 'success',
      title: t('Dashboard KPI success rate'),
      value: isAdmin ? formatUptimePct(successRate) : '—',
      description: isAdmin
        ? t('Dashboard KPI perf 24h')
        : t('Dashboard admin only metric'),
      icon: ShieldCheck,
      tone: 'teal' as const,
    },
    {
      key: 'latency',
      title: t('Dashboard KPI avg latency'),
      value: isAdmin ? formatLatency(avgLatencyMs) : '—',
      description: isAdmin
        ? t('Dashboard KPI perf 24h')
        : t('Dashboard admin only metric'),
      icon: Timer,
      tone: 'gray' as const,
    },
  ]

  return (
    <section className={COCKPIT_SECTION_CLASS}>
      <div className='grid xl:grid-cols-[minmax(0,1fr)_17rem]'>
        <div className='flex flex-col gap-4 p-4 sm:p-5'>
          <div className='flex flex-col gap-1'>
            <h3 className='text-base font-semibold text-slate-900'>
              {t('Dashboard KPI section title')}
            </h3>
            <p className='text-sm text-slate-600'>
              {t('Dashboard KPI section description')}
            </p>
          </div>

          <StaggerContainer className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            {kpiItems.map((it) => (
              <StaggerItem
                key={it.key}
                className={cn('cockpit-stat-card', COCKPIT_STAT_CARD_CLASS)}
              >
                <StatCard
                  title={it.title}
                  value={it.value}
                  description={it.description}
                  icon={it.icon}
                  tone={it.tone}
                  sparkline={it.sparkline}
                  sparklineVariant='line'
                  loading={'loading' in it ? it.loading : kpiLoading}
                  variant='cockpit'
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        <div className={COCKPIT_BALANCE_PANEL_CLASS}>
          <div className='flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-medium text-slate-600'>
                {t('Dashboard token balance label')}
              </span>
              <span className='flex items-center gap-1.5'>
                <span
                  className={cn('size-1.5 rounded-full', healthCfg.dotClass)}
                  aria-hidden='true'
                />
                <span className='text-[11px] font-medium text-slate-600'>
                  {t(healthCfg.labelKey)}
                </span>
              </span>
            </div>

            <div className='font-mono text-2xl font-semibold tracking-tight text-slate-900'>
              {formatQuotaForCockpit(remainQuota)}
            </div>

            <div className='grid grid-cols-2 gap-2'>
              <div className={cn('px-2.5 py-2', COCKPIT_INSET_SURFACE_CLASS)}>
                <div className='flex items-center gap-1 text-[11px] font-medium text-slate-500'>
                  <Flame className='size-3 shrink-0' aria-hidden='true' />
                  <span className='truncate'>
                    {t('Dashboard token usage 24h')}
                  </span>
                </div>
                <div className='mt-1.5 truncate text-xs font-semibold text-slate-800 tabular-nums'>
                  {formatQuotaForCockpit(recentUsage)}
                </div>
              </div>
              <div className={cn('px-2.5 py-2', COCKPIT_INSET_SURFACE_CLASS)}>
                <div className='flex items-center gap-1 text-[11px] font-medium text-slate-500'>
                  {runwayDays !== null && runwayDays < 3 ? (
                    <TrendingDown
                      className='size-3 shrink-0'
                      aria-hidden='true'
                    />
                  ) : (
                    <ShieldCheck
                      className='size-3 shrink-0'
                      aria-hidden='true'
                    />
                  )}
                  <span className='truncate'>{t('Dashboard runway label')}</span>
                </div>
                <div
                  className={cn(
                    'mt-1.5 truncate text-xs font-semibold tabular-nums',
                    healthLevel === 'critical' && 'text-red-600',
                    healthLevel === 'caution' && 'text-amber-600',
                    healthLevel === 'healthy' && 'text-slate-800'
                  )}
                >
                  {runwayDays !== null
                    ? runwayDays < 1
                      ? t('Dashboard less than 1 day')
                      : runwayDays > 999
                        ? `999+ ${t('Dashboard days suffix')}`
                        : `~${formatNumber(Math.floor(runwayDays))} ${t('Dashboard days suffix')}`
                    : remainQuota <= 0
                      ? t('Dashboard health critical')
                      : t('Dashboard no recent usage')}
                </div>
              </div>
            </div>

            <p className='text-[11px] text-slate-500'>
              {t('Dashboard historical usage hint', {
                used: formatQuotaForCockpit(usedQuota),
              })}
            </p>
          </div>

          <Button
            className='justify-between border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
            variant='outline'
            render={<Link to='/wallet' />}
          >
            <span>{t('Dashboard resource recharge')}</span>
            <ArrowRight data-icon='inline-end' />
          </Button>
        </div>
      </div>
    </section>
  )
}