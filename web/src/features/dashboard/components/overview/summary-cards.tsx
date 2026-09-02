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
import { Link } from '@tanstack/react-router'
import { ArrowRight, Flame, ShieldCheck, TrendingDown } from 'lucide-react'
import { type CSSProperties, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  YecaiAction,
  YecaiBentoGrid,
  YecaiBentoItem,
  YecaiPanel,
  type YecaiTone,
} from '@/components/yecai'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { useSummaryCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { useStatus } from '@/hooks/use-status'
import { getCurrencyLabel, isCurrencyDisplayEnabled } from '@/lib/currency'
import { formatNumber, formatQuota } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

const SUMMARY_SPARKLINE_BUCKETS = 12

type SummarySparklineKey = 'balance' | 'usage' | 'requests'

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

  return {
    balance: balanceTrend,
    usage,
    requests,
  }
}

function getSummarySparkline(
  key: string,
  sparklineData: Record<SummarySparklineKey, number[]>
): number[] | undefined {
  if (key === 'usage') return sparklineData.usage
  if (key === 'requests') return sparklineData.requests
  return undefined
}

function getRunwayDays(
  remainQuota: number,
  recentUsage: number
): number | null {
  if (remainQuota <= 0 || recentUsage <= 0) return null
  const days = remainQuota / recentUsage
  if (!Number.isFinite(days)) return null
  return days
}

type HealthLevel = 'healthy' | 'caution' | 'critical'

function SummarySparkline(props: { data?: number[]; tone: YecaiTone }) {
  const values = props.data?.length ? props.data : [0, 0, 0, 0]
  const max = Math.max(...values, 1)
  const denominator = Math.max(values.length - 1, 1)
  const points = values
    .map((value, index) => {
      const x = (index / denominator) * 100
      const y = 30 - (value / max) * 24
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      aria-hidden='true'
      className='dopa-dev-bento__sparkline'
      data-tone={props.tone}
      viewBox='0 0 100 32'
      preserveAspectRatio='none'
    >
      <polyline points={points} />
    </svg>
  )
}

function getHealthLevel(remainQuota: number, recentUsage: number): HealthLevel {
  if (remainQuota <= 0) return 'critical'
  const days = getRunwayDays(remainQuota, recentUsage)
  if (days !== null && days < 3) return 'caution'
  return 'healthy'
}

const HEALTH_CONFIG: Record<
  HealthLevel,
  { dotClass: string; labelKey: string }
> = {
  healthy: {
    dotClass: 'bg-success',
    labelKey: 'Healthy',
  },
  caution: {
    dotClass: 'bg-warning',
    labelKey: 'Low balance',
  },
  critical: {
    dotClass: 'bg-destructive',
    labelKey: 'Balance depleted',
  },
}

export function SummaryCards() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { status, loading } = useStatus()

  const summaryTimeRange = useMemo(() => computeTimeRange(1), [])
  const remainQuota = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)
  const requestCount = Number(user?.request_count ?? 0)

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
  })

  const summaryValues = useMemo(() => {
    return {
      usedDisplay: formatQuota(usedQuota),
      requestCountDisplay: formatNumber(requestCount),
    }
  }, [requestCount, usedQuota])

  const currencyEnabledFromStore = isCurrencyDisplayEnabled()
  const statusCurrencyFlag =
    typeof status?.display_in_currency === 'boolean'
      ? Boolean(status.display_in_currency)
      : undefined
  const currencyEnabled =
    statusCurrencyFlag !== undefined
      ? statusCurrencyFlag
      : currencyEnabledFromStore
  const currencyLabel = currencyEnabled ? getCurrencyLabel() : 'Tokens'

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

  const todayUsageDisplay = formatQuota(recentUsage)
  let runwayDisplay: string
  if (runwayDays !== null) {
    if (runwayDays < 1) {
      runwayDisplay = t('Less than 1 day left')
    } else if (runwayDays > 999) {
      runwayDisplay = `999+ ${t('days')}`
    } else {
      runwayDisplay = `~${formatNumber(Math.floor(runwayDays))} ${t('days')}`
    }
  } else if (remainQuota <= 0) {
    runwayDisplay = t('Balance depleted')
  } else {
    runwayDisplay = t('No recent usage')
  }

  const items = useSummaryCardsConfig({
    ...summaryValues,
    todayUsageDisplay,
    currencyEnabled,
    currencyLabel,
  }).map((config, index) => {
    const tones: YecaiTone[] = ['leaf', 'money', 'model']

    return {
      key: config.key,
      title: config.title,
      value: config.value,
      desc: config.description,
      icon: config.icon,
      tone: tones[index] ?? 'model',
      sparkline:
        config.key === 'todayUsage'
          ? sparklineData.usage
          : getSummarySparkline(config.key, sparklineData),
    }
  })

  const runwayProgress = Math.min(1, Math.max(0, (runwayDays ?? 0) / 30))
  const runwayStyle = {
    '--dopa-runway-angle': `${Math.max(36, runwayProgress * 360)}deg`,
  } as CSSProperties

  return (
    <YecaiPanel
      as='section'
      className='dopa-dev-bento'
      layer='raised'
      tone='signal'
    >
      <header className='dopa-dev-bento__header'>
        <div>
          <span>{t('Usage at a glance')}</span>
          <h3>{t('Monitor balance, usage, and request volume')}</h3>
        </div>
        <span className='dopa-dev-bento__live'>
          <i aria-hidden='true' />
          {loading ? t('Loading') : t('Live')}
        </span>
      </header>

      <YecaiBentoGrid className='dopa-dev-bento__grid'>
        <div className='dopa-dev-bento__metrics'>
          {items.map((item) => {
            const Icon = item.icon

            return (
              <YecaiBentoItem
                className='dopa-dev-bento__metric'
                key={item.key}
                tone={item.tone}
              >
                <span className='dopa-dev-bento__metric-icon'>
                  <Icon aria-hidden='true' />
                </span>
                <span>{item.title}</span>
                <strong>{loading ? '—' : item.value}</strong>
                <small>{item.desc}</small>
                <SummarySparkline data={item.sparkline} tone={item.tone} />
              </YecaiBentoItem>
            )
          })}
        </div>

        <YecaiBentoItem
          as='aside'
          className='dopa-dev-bento__runway'
          data-health={healthLevel}
          tone='signal'
        >
          <div className='dopa-dev-bento__runway-copy'>
            <span>{t('Credit remaining')}</span>
            <strong>{formatQuota(remainQuota)}</strong>
            <span className='dopa-dev-bento__health'>
              <i className={healthCfg.dotClass} aria-hidden='true' />
              {t(healthCfg.labelKey)}
            </span>
          </div>

          <div
            aria-label={`${t('Runway')}: ${runwayDisplay}`}
            className='dopa-dev-bento__orbit'
            style={runwayStyle}
          >
            {runwayDays !== null && runwayDays < 3 ? (
              <TrendingDown aria-hidden='true' />
            ) : (
              <ShieldCheck aria-hidden='true' />
            )}
            <strong>{runwayDisplay}</strong>
            <span>{t('Runway')}</span>
          </div>

          <div className='dopa-dev-bento__runway-foot'>
            <span>
              <Flame aria-hidden='true' />
              {t('Last 24h usage')}
            </span>
            <strong>{formatQuota(recentUsage)}</strong>
          </div>

          <YecaiAction
            appearance='soft'
            className='dopa-dev-bento__wallet'
            render={<Link to='/wallet' />}
            tone='money'
          >
            <span>{t('Wallet')}</span>
            <ArrowRight data-icon='inline-end' />
          </YecaiAction>
        </YecaiBentoItem>
      </YecaiBentoGrid>
    </YecaiPanel>
  )
}
