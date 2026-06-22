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
import {
  Activity,
  Building2,
  Coins,
  RadioTower,
  ShieldCheck,
  Timer,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { formatNumber } from '@/lib/format'
import { formatDate, formatDateTimeObject } from '@/lib/time'
import { ROLE } from '@/lib/roles'
import { getSelf } from '@/lib/api'
import { useStatus } from '@/hooks/use-status'
import { getChannels } from '@/features/channels/api'
import {
  getUserQuotaDataByUsers,
  getUserQuotaDates,
} from '@/features/dashboard/api'
import {
  countActiveAccountsFromQuotaData,
  isAccountActiveInQuotaData,
} from '@/features/dashboard/lib/stats'
import { useOpsRollingTimeRange } from '@/features/dashboard/hooks/use-ops-rolling-time-range'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import { CockpitHeader } from './cockpit-header'
import { formatQuotaForCockpit } from './cockpit-display'
import { OverviewKpiCard } from './overview-kpi-card'
import { OverviewQuotaBanner } from './overview-quota-banner'
import {
  OverviewMiniBars,
  computeDayOverDayChange,
} from './overview-sparkline'
import { OVERVIEW_KPI_TILE_CLASS } from './overview-reference-styles'

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
  const total = healthy + warning + critical
  return { healthy, warning, critical, total }
}

function sumField(items: QuotaDataItem[], field: 'count' | 'quota'): number {
  return items.reduce(
    (total, item) => total + (Number(item[field]) || 0),
    0
  )
}

function OverviewChannelsKpiCard(props: {
  enabled: string
  total: number
  healthy: number
  warning: number
  critical: number
  hint: string
  loading?: boolean
}) {
  const { t } = useTranslation()
  const barSegments = [
    { count: props.healthy, color: '#22C55E' },
    { count: props.warning, color: '#F59E0B' },
    { count: props.critical, color: '#EF4444' },
  ].filter((s) => s.count > 0)

  return (
    <article className={OVERVIEW_KPI_TILE_CLASS}>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-1.5'>
          <span className='flex size-6 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF]'>
            <RadioTower className='size-3.5 text-[#2563EB]' aria-hidden='true' />
          </span>
          <span className='truncate text-[12px] text-[#6B7280]'>
            {t('Dashboard KPI model channels')}
          </span>
        </div>
        {barSegments.length > 0 ? (
          <OverviewMiniBars segments={barSegments} />
        ) : (
          <OverviewMiniBars segments={[{ count: 1, color: '#E5E7EB' }]} />
        )}
      </div>

      <div className='mt-auto pt-1'>
        {props.loading ? (
          <div className='h-6 w-24 animate-pulse rounded bg-slate-100' />
        ) : (
          <p className='font-[DIN,sans-serif] text-[20px] font-bold leading-none text-[#111827]'>
            {props.enabled}
            {props.total > 0 ? (
              <span className='text-[15px] font-semibold text-[#9CA3AF]'>
                {' '}
                / {formatNumber(props.total)}
              </span>
            ) : null}
          </p>
        )}
        <p className='mt-1 truncate text-[11px] text-[#9CA3AF]'>
          {props.total > 0
            ? t('Dashboard KPI channels health breakdown', {
                healthy: props.healthy,
                warning: props.warning,
                critical: props.critical,
              })
            : props.hint}
        </p>
      </div>
    </article>
  )
}

export function SummaryCards() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const setUser = useAuthStore((state) => state.auth.setUser)
  const { loading: statusLoading } = useStatus()
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)

  const summaryTimeRange = useOpsRollingTimeRange(1)

  const priorTimeRange = useMemo(
    () => ({
      start_timestamp: summaryTimeRange.start_timestamp - 86400,
      end_timestamp: summaryTimeRange.end_timestamp - 86400,
    }),
    [summaryTimeRange.end_timestamp, summaryTimeRange.start_timestamp]
  )

  useQuery({
    queryKey: ['dashboard', 'overview', 'user-self'],
    queryFn: async () => {
      const response = await getSelf()
      if (!response?.success || !response.data) {
        throw new Error('Failed to load current user')
      }
      setUser(response.data as AuthUser)
      return response.data
    },
    staleTime: 60 * 1000,
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

  const totalChannelsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'total-channels-count'],
    queryFn: async () => {
      const response = await getChannels({ p: 1, page_size: 1 })
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

  const priorTrendQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'prior-sparklines',
      isAdmin,
      priorTimeRange.start_timestamp,
      priorTimeRange.end_timestamp,
    ],
    queryFn: async () =>
      getUserQuotaDates(
        {
          start_timestamp: priorTimeRange.start_timestamp,
          end_timestamp: priorTimeRange.end_timestamp,
          default_time: 'hour',
        },
        isAdmin
      ),
    staleTime: 60 * 1000,
    ...opsLiveDataQueryOptions,
  })

  const priorActiveAccountsQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'prior-active-accounts',
      priorTimeRange.start_timestamp,
      priorTimeRange.end_timestamp,
    ],
    queryFn: async () => {
      const response = await getUserQuotaDataByUsers({
        start_timestamp: priorTimeRange.start_timestamp,
        end_timestamp: priorTimeRange.end_timestamp,
      })
      if (!response.success) {
        throw new Error('Failed to load prior active account stats')
      }
      return response
    },
    enabled: isAdmin,
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
  const channelSegments = channelHealthSegments(perfModels)

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

  const dataFreshnessLabel = useMemo(() => {
    const updatedAt = usageTrendQuery.dataUpdatedAt
    const timeLabel =
      updatedAt > 0
        ? formatDateTimeObject(new Date(updatedAt))
        : t('Loading')
    const windowLabel = `${formatDate(summaryTimeRange.start_timestamp)} – ${formatDate(summaryTimeRange.end_timestamp)}`
    return {
      asOf: t('Dashboard data as of', { time: timeLabel }),
      window: `${t('Dashboard KPI rolling window hint')} (${windowLabel})`,
    }
  }, [
    summaryTimeRange.end_timestamp,
    summaryTimeRange.start_timestamp,
    t,
    usageTrendQuery.dataUpdatedAt,
  ])

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
  const adminTotalChannelsTotal = totalChannelsQuery.data?.data?.total
  const enabledCount =
    typeof adminEnabledChannelsTotal === 'number' ? adminEnabledChannelsTotal : 0
  const totalCount =
    typeof adminTotalChannelsTotal === 'number' ? adminTotalChannelsTotal : 0

  const channelsHint = isAdmin
    ? enabledChannelsQuery.isSuccess
      ? t('Dashboard KPI channels enabled hint')
      : enabledChannelsQuery.isError
        ? t('Dashboard KPI channels load failed hint')
        : t('Dashboard KPI channels placeholder hint')
    : t('Dashboard KPI channels admin only hint')

  const priorCalls = sumField(priorTrendQuery.data?.data ?? [], 'count')
  const priorUsage = sumField(priorTrendQuery.data?.data ?? [], 'quota')
  const callsTrend = computeDayOverDayChange(recentCalls, priorCalls)
  const usageTrend = computeDayOverDayChange(recentUsage, priorUsage)
  const priorActiveCount = countActiveAccountsFromQuotaData(
    priorActiveAccountsQuery.data?.data ?? []
  )
  const activeTrend = computeDayOverDayChange(
    adminActiveAccountCount,
    priorActiveCount
  )

  const perfMetricsLoading = isAdmin && metricsQuery.isLoading
  const perfMetricsHasData = perfModels.length > 0
  const perfMetricsUnavailable = isAdmin && metricsQuery.isError

  const successRateDisplay = !isAdmin
    ? '—'
    : perfMetricsUnavailable
      ? t('Unavailable')
      : perfMetricsHasData
        ? formatUptimePct(successRate)
        : t('Dashboard perf no data')

  const avgLatencyDisplay = !isAdmin
    ? '—'
    : perfMetricsUnavailable
      ? t('Unavailable')
      : perfMetricsHasData
        ? formatLatency(avgLatencyMs)
        : t('Dashboard perf no data')

  const perfMetricHint = !isAdmin
    ? t('Dashboard admin only metric')
    : perfMetricsUnavailable
      ? t('Dashboard perf metrics unavailable')
      : perfMetricsHasData
        ? t('Dashboard KPI perf 24h')
        : t('Dashboard perf no data hint')

  const perfMetricMuted =
    isAdmin && !perfMetricsLoading && (!perfMetricsHasData || perfMetricsUnavailable)

  return (
    <section className='flex flex-col gap-2'>
      <CockpitHeader
        quotaHealthLabel={t(healthCfg.labelKey)}
        quotaHealthDotClass={healthCfg.dotClass}
        dataWindowLabel={dataFreshnessLabel.window}
        dataAsOfLabel={dataFreshnessLabel.asOf}
      />

      <div className='grid grid-cols-2 gap-2 lg:grid-cols-4'>
        <OverviewKpiCard
          title={t('Dashboard KPI calls today')}
          value={formatNumber(recentCalls)}
          icon={Activity}
          sparkline={sparklineData.requests}
          sparklineColor='#2563EB'
          trend={callsTrend}
          loading={kpiLoading}
          hint={t('Dashboard KPI window 24h')}
        />
        <OverviewKpiCard
          title={t('Dashboard KPI tokens today')}
          value={formatQuotaForCockpit(recentUsage)}
          icon={Coins}
          iconBg='bg-[#F5F3FF]'
          iconColor='text-[#7C3AED]'
          sparkline={sparklineData.usage}
          sparklineColor='#8B5CF6'
          trend={usageTrend}
          loading={kpiLoading}
          hint={t('Dashboard KPI tokens description')}
        />
        <OverviewKpiCard
          title={t('Dashboard KPI active accounts')}
          value={isAdmin ? adminActiveAccountValue : selfActiveAccountValue}
          icon={Building2}
          trend={isAdmin ? activeTrend : undefined}
          loading={
            isAdmin ? activeAccountsQuery.isLoading : usageTrendQuery.isLoading
          }
          hint={
            isAdmin
              ? t('Dashboard KPI active accounts admin hint')
              : t('Dashboard KPI active accounts self hint')
          }
        />
        {isAdmin ? (
          <OverviewChannelsKpiCard
            enabled={enabledChannelsQuery.isSuccess ? formatNumber(enabledCount) : '—'}
            total={totalCount}
            healthy={channelSegments.healthy}
            warning={channelSegments.warning}
            critical={channelSegments.critical}
            hint={channelsHint}
            loading={enabledChannelsQuery.isLoading}
          />
        ) : (
          <OverviewKpiCard
            title={t('Dashboard KPI model channels')}
            value='—'
            icon={RadioTower}
            hint={t('Dashboard KPI channels admin only hint')}
          />
        )}
      </div>

      <div className='grid grid-cols-2 gap-2 lg:grid-cols-4'>
        <OverviewKpiCard
          title={t('Dashboard KPI success rate')}
          value={successRateDisplay}
          icon={ShieldCheck}
          iconBg='bg-[#ECFDF5]'
          iconColor='text-[#16A34A]'
          sparklineColor='#22C55E'
          loading={perfMetricsLoading}
          valueMuted={perfMetricMuted}
          hint={perfMetricHint}
        />
        <OverviewKpiCard
          title={t('Dashboard KPI avg latency')}
          value={avgLatencyDisplay}
          icon={Timer}
          loading={perfMetricsLoading}
          valueMuted={perfMetricMuted}
          hint={perfMetricHint}
        />
        <OverviewQuotaBanner
          remainQuota={remainQuota}
          usedQuota={usedQuota}
          recentUsage={recentUsage}
          runwayDays={runwayDays}
          healthLabel={t(healthCfg.labelKey)}
          healthDotClass={healthCfg.dotClass}
          healthLevel={healthLevel}
          loading={kpiLoading}
        />
      </div>
    </section>
  )
}
