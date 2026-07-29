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
import {
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Flame,
  ShieldCheck,
  Sparkles,
  TrendingDown,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getUserQuotaDates,
  getUserSavingsLifetime,
  getUserSavingsSummary,
} from '@/features/dashboard/api'
import { useSummaryCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
import {
  formatSavingsQuotaAsCNY,
  formatSavingsCNYMicros,
  getRollingSavingsTimeRange,
} from '@/features/dashboard/lib/savings'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { useStatus } from '@/hooks/use-status'
import { getCurrencyLabel, isCurrencyDisplayEnabled } from '@/lib/currency'
import { formatNumber, formatQuota, formatTimestampToDate } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { StatCard } from '../ui/stat-card'

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
  const currency = useSystemConfigStore((state) => state.config.currency)
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

  const savingsSummaryQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'savings-summary', 'rolling-24h'],
    queryFn: async () => getUserSavingsSummary(getRollingSavingsTimeRange()),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  })

  const savingsLifetimeQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'savings-lifetime'],
    queryFn: getUserSavingsLifetime,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
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
  const savingsSummary = savingsSummaryQuery.data?.data
  const savingsAmountDisplay =
    savingsSummary == null
      ? ''
      : formatSavingsQuotaAsCNY(
          savingsSummary.savings_quota,
          currency.quotaPerUnit,
          currency.usdExchangeRate
        )
  const reconstructedSavingsCount =
    savingsSummary?.reconstructed_request_count ?? 0
  const showSavingsSummary = savingsSummary != null
  const savingsLifetime = savingsLifetimeQuery.data?.data
  const showSavingsLifetime =
    savingsLifetime?.enabled === true &&
    savingsLifetime.show_on_dashboard === true
  const lifetimeAmountDisplay = showSavingsLifetime
    ? formatSavingsCNYMicros(savingsLifetime.savings_cny_micros)
    : ''
  const lifetimeCoverageDisplay = showSavingsLifetime
    ? Intl.NumberFormat(undefined, {
        style: 'percent',
        maximumFractionDigits: 0,
      }).format(savingsLifetime.coverage_ratio)
    : ''
  let lifetimeDescription = ''
  if (showSavingsLifetime) {
    if (savingsLifetime.backfill_status === 'failed') {
      lifetimeDescription = t('Historical savings backfill failed')
    } else if (!savingsLifetime.is_complete) {
      lifetimeDescription = t(
        'Counted so far · {{coverage}} coverage · {{progress}} backfilled',
        {
          coverage: lifetimeCoverageDisplay,
          progress: Intl.NumberFormat(undefined, {
            style: 'percent',
            maximumFractionDigits: 0,
          }).format(savingsLifetime.backfill_progress),
        }
      )
    } else if (savingsLifetime.statistics_started_at > 0) {
      lifetimeDescription = t('Since {{date}} · {{coverage}} coverage', {
        date: formatTimestampToDate(savingsLifetime.statistics_started_at),
        coverage: lifetimeCoverageDisplay,
      })
    } else {
      lifetimeDescription = t('No lifetime savings records yet')
    }
  }
  const hasPositiveSavings =
    savingsSummary?.enabled === true &&
    !savingsSummary.is_partial &&
    savingsSummary.savings_quota > 0
  const savingsCoverageDisplay =
    savingsSummary != null
      ? Intl.NumberFormat(undefined, {
          style: 'percent',
          maximumFractionDigits: 0,
        }).format(savingsSummary.coverage_ratio)
      : ''
  let savingsSummaryDescription = t('Estimated from official pricing')
  if (savingsSummary) {
    if (!savingsSummary.enabled) {
      savingsSummaryDescription = t('Savings estimate is not enabled')
    } else if (savingsSummary.is_partial) {
      savingsSummaryDescription = t('Too many records to summarize')
    } else if (savingsSummary.estimated_request_count === 0) {
      savingsSummaryDescription = t('No eligible savings records yet')
    } else {
      savingsSummaryDescription = `${t('Estimated from official pricing')} · ${t(
        '{{coverage}} coverage',
        {
          coverage: savingsCoverageDisplay,
        }
      )}`
    }
  }
  if (
    savingsSummary?.enabled === true &&
    !savingsSummary.is_partial &&
    reconstructedSavingsCount > 0
  ) {
    savingsSummaryDescription = `${savingsSummaryDescription} · ${t(
      '{{count}} historical requests recalculated at current official prices',
      { count: reconstructedSavingsCount }
    )}`
  }
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
    const tones = ['accent-1', 'accent-2', 'accent-3'] as const

    return {
      key: config.key,
      title: config.title,
      value: config.value,
      desc: config.description,
      icon: config.icon,
      tone: tones[index] ?? 'accent-3',
      sparkline:
        config.key === 'todayUsage'
          ? sparklineData.usage
          : getSummarySparkline(config.key, sparklineData),
      sparklineVariant: 'line' as const,
    }
  })

  return (
    <div className='bg-card overflow-hidden rounded-lg border shadow-xs'>
      <div className='grid xl:grid-cols-[minmax(0,1fr)_19rem]'>
        <div className='flex flex-col gap-2.5 p-3 sm:gap-3 sm:p-5'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='flex flex-col gap-1'>
              <h3 className='text-sm font-semibold sm:text-base'>
                {t('Usage at a glance')}
              </h3>
              <p className='text-muted-foreground text-xs sm:text-sm'>
                {t('Monitor balance, usage, and request volume')}
              </p>
            </div>
          </div>
          <StaggerContainer className='divide-border grid grid-cols-3 divide-x rounded-md border'>
            {items.map((it) => (
              <StaggerItem key={it.key} className='min-w-0 px-2 py-1.5 sm:p-3'>
                <StatCard
                  title={it.title}
                  value={it.value}
                  description={it.desc}
                  icon={it.icon}
                  tone={it.tone}
                  sparkline={it.sparkline}
                  sparklineVariant={it.sparklineVariant}
                  loading={loading}
                  compactMobile
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        <div className='bg-muted/40 flex flex-col justify-between gap-3 border-t p-3 sm:gap-4 sm:p-5 xl:border-t-0 xl:border-l'>
          <div className='flex flex-col gap-2 sm:gap-3'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-xs font-medium'>
                {t('Credit remaining')}
              </span>
              <span className='flex items-center gap-1.5'>
                <span
                  className={cn('size-1.5 rounded-full', healthCfg.dotClass)}
                  aria-hidden='true'
                />
                <span className='text-muted-foreground text-[11px] font-medium'>
                  {t(healthCfg.labelKey)}
                </span>
              </span>
            </div>

            <div className='font-mono text-xl font-semibold tracking-tight sm:text-2xl'>
              {formatQuota(remainQuota)}
            </div>

            <div className='grid grid-cols-2 gap-2'>
              <div className='bg-background rounded-md border px-2.5 py-2'>
                <div className='text-muted-foreground flex items-center gap-1 text-[11px] leading-none font-medium'>
                  <Flame className='size-3 shrink-0' aria-hidden='true' />
                  <span className='truncate'>{t('Last 24h usage')}</span>
                </div>
                <div className='text-foreground mt-1.5 truncate text-xs font-semibold tabular-nums'>
                  {formatQuota(recentUsage)}
                </div>
              </div>
              <div className='bg-background rounded-md border px-2.5 py-2'>
                <div className='text-muted-foreground flex items-center gap-1 text-[11px] leading-none font-medium'>
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
                  <span className='truncate'>{t('Runway')}</span>
                </div>
                <div
                  className={cn(
                    'mt-1.5 truncate text-xs font-semibold tabular-nums',
                    healthLevel === 'critical' && 'text-destructive',
                    healthLevel === 'caution' && 'text-warning'
                  )}
                >
                  {runwayDisplay}
                </div>
              </div>
            </div>

            {(showSavingsSummary || showSavingsLifetime) && (
              <div className='bg-background rounded-md border px-2.5 py-2'>
                {showSavingsSummary && savingsSummary && (
                  <div>
                    <div
                      className={cn(
                        'flex items-start justify-between gap-2 text-xs leading-snug font-semibold',
                        hasPositiveSavings ? 'text-success' : 'text-foreground'
                      )}
                    >
                      <div className='flex min-w-0 items-center gap-1'>
                        <BadgeDollarSign
                          className='size-3.5 shrink-0'
                          aria-hidden='true'
                        />
                        <span className='min-w-0'>
                          {hasPositiveSavings
                            ? t(
                                'In the last 24 hours, RAPI saved you about {{amount}}',
                                { amount: savingsAmountDisplay }
                              )
                            : `${t('Last 24h savings estimate')}: ${savingsAmountDisplay}`}
                        </span>
                      </div>
                      {savingsSummary.enabled && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Link
                                to='/dashboard/$section'
                                params={{ section: 'models' }}
                                className='text-muted-foreground hover:text-foreground inline-flex shrink-0'
                                aria-label={t('View savings trend')}
                              />
                            }
                          >
                            <ArrowUpRight
                              className='size-3.5'
                              aria-hidden='true'
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('View savings trend')}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className='text-muted-foreground mt-1 text-[11px] leading-snug'>
                      {savingsSummaryDescription}
                    </div>
                    {savingsSummary.official_price_stale &&
                      savingsSummary.source_updated_at > 0 && (
                        <div className='text-warning mt-1 text-[11px] leading-snug'>
                          {t('Official price updated {{time}}', {
                            time: formatTimestampToDate(
                              savingsSummary.source_updated_at
                            ),
                          })}
                        </div>
                      )}
                  </div>
                )}
                {showSavingsLifetime && (
                  <div
                    className={cn(
                      'flex min-w-0 items-start gap-1',
                      showSavingsSummary && 'mt-2 border-t pt-2'
                    )}
                  >
                    <Sparkles
                      className='text-success mt-0.5 size-3.5 shrink-0'
                      aria-hidden='true'
                    />
                    <div className='min-w-0'>
                      <div className='text-success text-xs leading-snug font-semibold break-words'>
                        {savingsLifetime.is_complete
                          ? t('RAPI has saved you about {{amount}} in total', {
                              amount: lifetimeAmountDisplay,
                            })
                          : t('Lifetime savings counted so far: {{amount}}', {
                              amount: lifetimeAmountDisplay,
                            })}
                      </div>
                      <div className='text-muted-foreground mt-1 text-[11px] leading-snug'>
                        {lifetimeDescription}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Button className='justify-between' render={<Link to='/wallet' />}>
            <span>{t('Wallet')}</span>
            <ArrowRight data-icon='inline-end' />
          </Button>
        </div>
      </div>
    </div>
  )
}
