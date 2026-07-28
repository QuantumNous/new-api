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
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import { BadgeDollarSign, CircleAlert, Info, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import { getUserSavingsTrend } from '@/features/dashboard/api'
import { getDefaultDays } from '@/features/dashboard/lib'
import { formatSavingsQuotaAsCNY } from '@/features/dashboard/lib/savings'
import {
  buildSavingsTrendChartData,
  calculateSavingsRate,
  normalizeSavingsTrendGranularity,
} from '@/features/dashboard/lib/savings-chart'
import type { DashboardFilters } from '@/features/dashboard/types'
import { toIntlLocale } from '@/i18n/languages'
import { ROLE } from '@/lib/roles'
import { useThemeRadiusPx } from '@/lib/theme-radius'
import { computeTimeRange } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

interface SavingsTrendChartProps {
  filters?: DashboardFilters
}

function formatPercent(value: number, locale: Intl.LocalesArgument): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

export function SavingsTrendChart(props: SavingsTrendChartProps) {
  const { t, i18n } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
  const chartRadius = useThemeRadiusPx(
    '--radius-sm',
    `${customization.preset}:${customization.radius}`
  )
  const userRole = useAuthStore((state) => state.auth.user?.role)
  const currency = useSystemConfigStore((state) => state.config.currency)
  const isAdmin = Boolean(userRole && userRole >= ROLE.ADMIN)
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (module) => module.ThemeManager
        )
      }
      const ThemeManager = await themeManagerPromise
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }

    void updateTheme()
  }, [resolvedTheme])

  const timeRange = useMemo(
    () =>
      computeTimeRange(
        getDefaultDays(props.filters?.time_granularity),
        props.filters?.start_timestamp,
        props.filters?.end_timestamp
      ),
    [
      props.filters?.end_timestamp,
      props.filters?.start_timestamp,
      props.filters?.time_granularity,
    ]
  )
  const durationSeconds = timeRange.end_timestamp - timeRange.start_timestamp
  const granularity = normalizeSavingsTrendGranularity(
    props.filters?.time_granularity,
    durationSeconds
  )
  const utcOffsetMinutes = -new Date().getTimezoneOffset()
  const trendQuery = useQuery({
    queryKey: [
      'dashboard',
      'savings-trend',
      timeRange.start_timestamp,
      timeRange.end_timestamp,
      granularity,
      utcOffsetMinutes,
    ],
    queryFn: () =>
      getUserSavingsTrend({
        ...timeRange,
        granularity,
        utc_offset_minutes: utcOffsetMinutes,
      }),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const trend = trendQuery.data?.data
  const chartData = useMemo(
    () =>
      trend
        ? buildSavingsTrendChartData(
            trend,
            currency.quotaPerUnit,
            currency.usdExchangeRate
          )
        : [],
    [trend, currency.quotaPerUnit, currency.usdExchangeRate]
  )
  const formatCNY = useCallback(
    (value: number | null | undefined): string => {
      if (value == null || !Number.isFinite(value)) return '-'
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'CNY',
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: Math.abs(value) >= 1 ? 2 : 4,
      }).format(value)
    },
    [locale]
  )
  const formatCompactCNY = useCallback(
    (value: number): string => {
      const absoluteValue = Math.abs(value)
      let maximumFractionDigits = 3
      if (absoluteValue >= 1) {
        maximumFractionDigits = 1
      } else if (absoluteValue >= 0.1) {
        maximumFractionDigits = 2
      }
      return `¥${new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits,
      }).format(value)}`
    },
    [locale]
  )

  const chartSpec = useMemo(
    () => ({
      type: 'common',
      data: [{ id: 'savingsTrend', values: chartData }],
      series: [
        {
          type: 'bar',
          dataId: 'savingsTrend',
          xField: 'Time',
          yField: 'Savings',
          bar: {
            style: {
              fill: '#16a34a',
              fillOpacity: 0.24,
              cornerRadius: chartRadius,
            },
          },
        },
        {
          type: 'line',
          dataId: 'savingsTrend',
          xField: 'Time',
          yField: 'Official',
          seriesField: 'LineSegment',
          invalidType: 'break',
          tooltip: { visible: false },
          line: {
            style: {
              stroke: '#64748b',
              lineWidth: 2,
              lineDash: [6, 4],
              curveType: 'linear',
            },
          },
          point: { visible: false },
        },
        {
          type: 'line',
          dataId: 'savingsTrend',
          xField: 'Time',
          yField: 'Actual',
          seriesField: 'LineSegment',
          invalidType: 'break',
          tooltip: { visible: false },
          line: {
            style: {
              stroke: '#0284c7',
              lineWidth: 2.5,
              curveType: 'linear',
            },
          },
          point: { visible: false },
        },
      ],
      axes: [
        {
          orient: 'left',
          label: {
            formatMethod: (value: string | number) =>
              formatCompactCNY(Number(value) || 0),
          },
        },
        {
          orient: 'bottom',
          type: 'band',
          label: { autoHide: true, autoRotate: true },
        },
      ],
      legends: { visible: false },
      tooltip: {
        dimension: {
          content: [
            {
              key: t('Official price estimate'),
              value: (datum: Record<string, unknown>) =>
                formatCNY(Number(datum?.Official)),
            },
            {
              key: t('Covered request actual cost'),
              value: (datum: Record<string, unknown>) =>
                formatCNY(Number(datum?.Actual)),
            },
            {
              key: t('Estimated savings'),
              value: (datum: Record<string, unknown>) =>
                formatCNY(Number(datum?.Savings)),
            },
            {
              key: t('Covered requests'),
              value: (datum: Record<string, unknown>) =>
                `${Number(datum?.EstimatedRequestCount) || 0} / ${
                  Number(datum?.RequestCount) || 0
                } (${formatPercent(
                  Number(datum?.CoverageRatio) || 0,
                  locale
                )})`,
            },
            {
              key: t('Historical rebuilds'),
              value: (datum: Record<string, unknown>) =>
                String(Number(datum?.ReconstructedRequestCount) || 0),
            },
          ],
        },
      },
      background: 'transparent',
      animation: true,
    }),
    [chartData, chartRadius, formatCNY, formatCompactCNY, locale, t]
  )

  if (trend && !trend.summary.enabled) return null

  const title = isAdmin
    ? t('Current account cost comparison')
    : t('Cost comparison')
  const summary = trend?.summary
  const savingsDisplay = summary
    ? formatSavingsQuotaAsCNY(
        summary.savings_quota,
        currency.quotaPerUnit,
        currency.usdExchangeRate,
        locale
      )
    : '-'
  const savingsRate = summary ? calculateSavingsRate(summary) : 0
  const hasRequests = Boolean(summary && summary.request_count > 0)
  const hasEstimates = Boolean(summary && summary.estimated_request_count > 0)
  const isEmpty = !hasRequests || !hasEstimates
  const isLoading = trendQuery.isLoading && !trend
  const isError = !isLoading && trendQuery.isError
  const isPartial = !isLoading && !isError && Boolean(summary?.is_partial)
  const showEmpty = !isLoading && !isError && !isPartial && isEmpty
  const showChart = !isLoading && !isError && !isPartial && !isEmpty
  let emptyMessage = t('No usage records in the selected range')
  if (hasRequests) emptyMessage = t('No eligible savings records yet')

  return (
    <section
      className='overflow-hidden rounded-lg border'
      aria-label={
        summary
          ? `${title}: ${t('Estimated savings')} ${savingsDisplay}, ${t(
              '{{coverage}} coverage',
              { coverage: formatPercent(summary.coverage_ratio, locale) }
            )}`
          : title
      }
    >
      <div className='flex flex-col gap-2 border-b px-3 py-2.5 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex min-w-0 items-center gap-2'>
          <IconBadge tone='success' size='sm'>
            <BadgeDollarSign aria-hidden='true' />
          </IconBadge>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-x-2 gap-y-0.5'>
              <h2 className='text-sm font-semibold'>{title}</h2>
              {isAdmin && (
                <span className='text-muted-foreground text-xs'>
                  {t('Current account only')}
                </span>
              )}
            </div>
            <div className='text-muted-foreground text-xs'>
              {t('Converted at 1 USD = {{rate}} CNY', {
                rate: currency.usdExchangeRate,
              })}
            </div>
          </div>
        </div>

        <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
          <div>
            <span className='text-muted-foreground'>
              {t('Estimated savings')}
            </span>{' '}
            <strong className='text-success font-mono tabular-nums'>
              {savingsDisplay}
            </strong>
          </div>
          <div className='border-l pl-3'>
            <span className='text-muted-foreground'>{t('Savings rate')}</span>{' '}
            <strong className='font-mono tabular-nums'>
              {formatPercent(savingsRate, locale)}
            </strong>
          </div>
          <div className='border-l pl-3'>
            <span className='text-muted-foreground'>{t('Coverage')}</span>{' '}
            <strong className='font-mono tabular-nums'>
              {formatPercent(summary?.coverage_ratio ?? 0, locale)}
            </strong>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className='p-3 sm:p-4'>
          <Skeleton className='h-[300px] w-full sm:h-[360px]' />
        </div>
      )}
      {isError && (
        <div className='text-muted-foreground flex h-[300px] flex-col items-center justify-center gap-3 px-4 text-sm sm:h-[360px]'>
          <CircleAlert className='size-5' aria-hidden='true' />
          <span>{t('Unable to load savings trend')}</span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void trendQuery.refetch()}
          >
            <RefreshCw />
            {t('Retry')}
          </Button>
        </div>
      )}
      {isPartial && (
        <div className='text-muted-foreground flex h-[300px] items-center justify-center px-4 text-center text-sm sm:h-[360px]'>
          {t('Too many records to summarize')}
        </div>
      )}
      {showEmpty && (
        <div className='text-muted-foreground flex h-[300px] items-center justify-center px-4 text-center text-sm sm:h-[360px]'>
          {emptyMessage}
        </div>
      )}
      {showChart && (
        <>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pt-2.5 text-xs sm:px-5'>
            <div className='flex items-center gap-1.5'>
              <span className='w-5 border-t-2 border-dashed border-slate-500' />
              {t('Official price estimate')}
            </div>
            <div className='flex items-center gap-1.5'>
              <span className='w-5 border-t-[3px] border-sky-600' />
              {t('Covered request actual cost')}
            </div>
            <div className='flex items-center gap-1.5'>
              <span className='h-2.5 w-5 bg-green-600/25' />
              {t('Estimated savings')}
            </div>
          </div>
          <div className='h-[300px] p-1.5 sm:h-[360px] sm:p-2'>
            {themeReady && (
              <VChart
                spec={{
                  ...chartSpec,
                  theme: resolvedTheme === 'dark' ? 'dark' : 'light',
                }}
                option={VCHART_OPTION}
              />
            )}
          </div>
          {summary && (summary.reconstructed_request_count ?? 0) > 0 && (
            <div className='text-muted-foreground flex items-center gap-1.5 border-t px-3 py-2 text-[11px] sm:px-5'>
              <Info className='size-3.5 shrink-0' aria-hidden='true' />
              <span>
                {t(
                  '{{count}} historical requests recalculated at current official prices',
                  { count: summary.reconstructed_request_count ?? 0 }
                )}
              </span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type='button'
                      className='text-muted-foreground hover:text-foreground inline-flex'
                      aria-label={t('About historical savings estimates')}
                    />
                  }
                >
                  <Info className='size-3' aria-hidden='true' />
                </TooltipTrigger>
                <TooltipContent>
                  {t(
                    'Historical usage is recalculated using current official prices'
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          <div className='sr-only overflow-hidden'>
            <table>
              <caption>{title}</caption>
              <thead>
                <tr>
                  <th>{t('Time')}</th>
                  <th>{t('Official price estimate')}</th>
                  <th>{t('Covered request actual cost')}</th>
                  <th>{t('Estimated savings')}</th>
                  <th>{t('Coverage')}</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((point) => (
                  <tr key={point.BucketStart}>
                    <td>{point.Time}</td>
                    <td>{formatCNY(point.Official)}</td>
                    <td>{formatCNY(point.Actual)}</td>
                    <td>{formatCNY(point.Savings)}</td>
                    <td>{formatPercent(point.CoverageRatio, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
