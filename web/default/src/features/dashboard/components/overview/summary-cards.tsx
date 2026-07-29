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
  Activity,
  ArrowRight,
  Flame,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserQuotaDates } from '@/features/dashboard/api'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { formatNumber, formatQuota } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const SUMMARY_BUCKETS = 24

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

function buildTrendRows(
  data: QuotaDataItem[],
  start: number,
  end: number
): Array<{ label: string; usage: number; requests: number }> {
  const usage = Array.from({ length: SUMMARY_BUCKETS }, () => 0)
  const requests = Array.from({ length: SUMMARY_BUCKETS }, () => 0)

  for (const item of data) {
    const timestamp = Number(item.created_at) || start
    const index = getBucketIndex(timestamp, start, end, SUMMARY_BUCKETS)
    usage[index] += Number(item.quota) || 0
    requests[index] += Number(item.count) || 0
  }

  return usage.map((value, index) => ({
    label: `${index}`,
    usage: value,
    requests: requests[index],
  }))
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
  healthy: { dotClass: 'bg-success', labelKey: 'Healthy' },
  caution: { dotClass: 'bg-warning', labelKey: 'Low balance' },
  critical: { dotClass: 'bg-destructive', labelKey: 'Balance depleted' },
}

function KpiTile(props: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'chart-1' | 'chart-2' | 'chart-3'
  loading?: boolean
}) {
  const Icon = props.icon
  return (
    <div className='bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1'>
      <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
        <IconBadge tone={props.tone} size='stat'>
          <Icon />
        </IconBadge>
        <span className='truncate'>{props.title}</span>
      </div>
      {props.loading ? (
        <Skeleton className='h-8 w-24' />
      ) : (
        <div className='font-mono text-xl font-semibold tracking-tight tabular-nums sm:text-2xl'>
          {props.value}
        </div>
      )}
    </div>
  )
}

export function SummaryCards() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const gradientId = useId().replaceAll(':', '')

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

  const trendRows = useMemo(
    () =>
      buildTrendRows(
        usageTrendQuery.data?.data ?? [],
        summaryTimeRange.start_timestamp,
        summaryTimeRange.end_timestamp
      ),
    [
      summaryTimeRange.end_timestamp,
      summaryTimeRange.start_timestamp,
      usageTrendQuery.data?.data,
    ]
  )

  const recentUsage = useMemo(
    () => trendRows.reduce((total, row) => total + row.usage, 0),
    [trendRows]
  )

  const healthLevel = getHealthLevel(remainQuota, recentUsage)
  const healthCfg = HEALTH_CONFIG[healthLevel]
  const runwayDays = getRunwayDays(remainQuota, recentUsage)
  const loading = usageTrendQuery.isLoading

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

  const chartConfig = {
    usage: { label: t('Last 24h usage'), color: 'var(--chart-1)' },
  } satisfies ChartConfig

  return (
    <StaggerContainer className='grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,0.9fr)] lg:gap-4'>
      <StaggerItem className='min-w-0'>
        <div className='bg-card ring-foreground/10 flex h-full flex-col overflow-hidden rounded-xl ring-1'>
          <div className='flex items-center justify-between gap-3 border-b px-4 py-3'>
            <div className='flex items-center gap-2'>
              <IconBadge tone='chart-1' size='sm'>
                <Flame />
              </IconBadge>
              <h3 className='text-sm font-semibold'>{t('Last 24h usage')}</h3>
            </div>
            <span className='font-mono text-sm font-semibold tabular-nums'>
              {formatQuota(recentUsage)}
            </span>
          </div>
          <div className='min-h-52 flex-1 p-3 sm:min-h-64 sm:p-4'>
            {loading ? (
              <Skeleton className='h-full w-full' />
            ) : (
              <ChartContainer
                config={chartConfig}
                className='aspect-auto h-full w-full'
              >
                <AreaChart
                  data={trendRows}
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
                      <stop
                        offset='0%'
                        stopColor='var(--chart-1)'
                        stopOpacity={0.4}
                      />
                      <stop
                        offset='100%'
                        stopColor='var(--chart-1)'
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray='3 3' />
                  <XAxis dataKey='label' hide />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(value) => formatQuota(Number(value) || 0)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <span className='font-mono tabular-nums'>
                            {formatQuota(Number(value) || 0)}
                          </span>
                        )}
                      />
                    }
                  />
                  <Area
                    type='monotone'
                    dataKey='usage'
                    stroke='var(--chart-1)'
                    fill={`url(#${gradientId})`}
                    strokeWidth={2.25}
                    dot={false}
                    isAnimationActive
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </div>
        </div>
      </StaggerItem>

      <StaggerItem className='flex min-w-0 flex-col gap-3'>
        <div className='bg-card ring-foreground/10 flex flex-1 flex-col justify-between gap-4 rounded-xl p-4 ring-1 sm:p-5'>
          <div className='flex flex-col gap-3'>
            <div className='flex items-center justify-between gap-2'>
              <span className='text-muted-foreground text-xs font-medium'>
                {t('Credit remaining')}
              </span>
              <span className='inline-flex items-center gap-1.5'>
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    healthCfg.dotClass,
                    healthLevel === 'healthy' && 'motion-safe:animate-pulse'
                  )}
                  aria-hidden='true'
                />
                <span className='text-muted-foreground text-[11px] font-medium'>
                  {t(healthCfg.labelKey)}
                </span>
              </span>
            </div>
            <div className='font-mono text-3xl font-semibold tracking-tight tabular-nums'>
              {formatQuota(remainQuota)}
            </div>
            <div className='bg-muted/40 flex items-center justify-between gap-2 rounded-lg px-3 py-2.5'>
              <div className='text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium'>
                {runwayDays !== null && runwayDays < 3 ? (
                  <TrendingDown className='size-3' aria-hidden='true' />
                ) : (
                  <ShieldCheck className='size-3' aria-hidden='true' />
                )}
                {t('Runway')}
              </div>
              <div
                className={cn(
                  'text-xs font-semibold tabular-nums',
                  healthLevel === 'critical' && 'text-destructive',
                  healthLevel === 'caution' && 'text-warning'
                )}
              >
                {runwayDisplay}
              </div>
            </div>
          </div>
          <Button
            className='w-full justify-between'
            render={<Link to='/wallet' />}
          >
            <span className='inline-flex items-center gap-2'>
              <Wallet className='size-4' aria-hidden='true' />
              {t('Wallet')}
            </span>
            <ArrowRight data-icon='inline-end' />
          </Button>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <KpiTile
            title={t('Historical Usage')}
            value={formatQuota(usedQuota)}
            icon={TrendingUp}
            tone='chart-2'
          />
          <KpiTile
            title={t('Request Count')}
            value={formatNumber(requestCount)}
            icon={Activity}
            tone='chart-3'
          />
        </div>
      </StaggerItem>
    </StaggerContainer>
  )
}
