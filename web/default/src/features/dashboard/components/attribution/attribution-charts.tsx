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
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import { ChevronRight, Loader2, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatLogQuota, formatNumber } from '@/lib/format'
import { getRollingDateRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import { VCHART_OPTION } from '@/lib/vchart'
import { useTheme } from '@/context/theme-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getLogAttribution,
  getLogAttributionTrend,
} from '@/features/dashboard/api'
import { TIME_RANGE_PRESETS } from '@/features/dashboard/constants'
import { getDefaultDays } from '@/features/dashboard/lib'
import {
  ATTRIBUTION_SERIES_COLORS,
  buildAttributionTrendSpec,
} from '@/features/dashboard/lib/attribution-chart'
import type {
  AttributionDimension,
  AttributionRow,
  AttributionTotal,
} from '@/features/dashboard/types'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

const RANKING_TOP = 50
const TREND_TOP = 6
const TOP_LIMIT_OPTIONS = [10, 20, 50]
const DIMENSIONS: AttributionDimension[] = ['user', 'token', 'model']

interface TimeRange {
  start_timestamp: number
  end_timestamp: number
}

function useDimensionLabels(): Record<AttributionDimension, string> {
  const { t } = useTranslation()
  return useMemo(
    () => ({
      user: t('User'),
      token: t('Token'),
      model: t('Model'),
    }),
    [t]
  )
}

function rowLabel(row: AttributionRow, fallback: string): string {
  return row.label || row.key || fallback
}

function SummaryCards(props: { total: AttributionTotal; loading: boolean }) {
  const { t } = useTranslation()
  const items = [
    { label: t('Total Cost'), value: formatLogQuota(props.total.quota) },
    { label: t('Calls'), value: formatNumber(props.total.count) },
    {
      label: t('Input Tokens'),
      value: formatNumber(props.total.prompt_tokens),
    },
    {
      label: t('Output Tokens'),
      value: formatNumber(props.total.completion_tokens),
    },
  ]
  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
      {items.map((item) => (
        <div key={item.label} className='rounded-lg border px-4 py-3'>
          <div className='text-muted-foreground text-xs'>{item.label}</div>
          {props.loading ? (
            <Skeleton className='mt-1.5 h-6 w-20' />
          ) : (
            <div className='text-foreground mt-0.5 font-mono text-xl font-semibold tabular-nums'>
              {item.value}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function DrillRows(props: {
  dimension: AttributionDimension
  parentKey: string
  timeRange: TimeRange
}) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: [
      'attribution-drill',
      props.dimension,
      props.parentKey,
      props.timeRange,
    ],
    queryFn: async () => {
      const result = await getLogAttribution({
        dimension: props.dimension,
        sub: 'model',
        parent_id: props.parentKey,
        top: 20,
        ...props.timeRange,
      })
      return result.success ? result.data : undefined
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className='space-y-1.5 px-4 py-2'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-2/3' />
      </div>
    )
  }

  const rows = data?.rows || []
  const subtotal = data?.total.quota || 0
  if (rows.length === 0) {
    return (
      <div className='text-muted-foreground px-4 py-2 text-xs'>
        {t('No data')}
      </div>
    )
  }

  return (
    <div className='space-y-1 px-4 py-2'>
      <div className='text-muted-foreground text-xs'>{t('Model breakdown')}</div>
      {rows.map((row, index) => {
        const share = subtotal > 0 ? (row.quota / subtotal) * 100 : 0
        return (
          <div key={row.key} className='flex items-center gap-2 text-xs'>
            <div className='w-40 shrink-0 truncate font-medium'>
              {rowLabel(row, t('(empty)'))}
            </div>
            <div className='bg-muted/60 h-2 flex-1 overflow-hidden rounded-full'>
              <div
                className='h-full rounded-full'
                style={{
                  width: `${share}%`,
                  backgroundColor:
                    ATTRIBUTION_SERIES_COLORS[
                      index % ATTRIBUTION_SERIES_COLORS.length
                    ],
                }}
              />
            </div>
            <div className='w-12 shrink-0 text-right tabular-nums'>
              {share.toFixed(1)}%
            </div>
            <div className='w-24 shrink-0 text-right font-mono tabular-nums'>
              {formatLogQuota(row.quota)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RankingTable(props: {
  dimension: AttributionDimension
  rows: AttributionRow[]
  total: AttributionTotal
  loading: boolean
  timeRange: TimeRange
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const canDrill = props.dimension !== 'model'

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  if (props.loading) {
    return (
      <div className='space-y-2'>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className='h-9 w-full' />
        ))}
      </div>
    )
  }

  if (props.rows.length === 0) {
    return (
      <div className='text-muted-foreground rounded-lg border py-10 text-center text-sm'>
        {t('No data')}
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <table className='w-full text-[13px]'>
        <thead className='bg-muted/40 text-muted-foreground'>
          <tr>
            <th className='px-3 py-2 text-left font-medium'>{t('Name')}</th>
            <th className='px-3 py-2 text-left font-medium'>{t('Share')}</th>
            <th className='px-3 py-2 text-right font-medium'>
              {t('Total Cost')}
            </th>
            <th className='hidden px-3 py-2 text-right font-medium sm:table-cell'>
              {t('Input Tokens')}
            </th>
            <th className='hidden px-3 py-2 text-right font-medium sm:table-cell'>
              {t('Output Tokens')}
            </th>
            <th className='px-3 py-2 text-right font-medium'>{t('Calls')}</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => {
            const share =
              props.total.quota > 0 ? (row.quota / props.total.quota) * 100 : 0
            const isOpen = expanded.has(row.key)
            return (
              <Fragment key={row.key}>
                <tr
                  className={cn(
                    'border-t',
                    canDrill &&
                      'hover:bg-muted/40 focus-visible:bg-muted/40 cursor-pointer outline-none'
                  )}
                  onClick={canDrill ? () => toggle(row.key) : undefined}
                  onKeyDown={
                    canDrill
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            toggle(row.key)
                          }
                        }
                      : undefined
                  }
                  tabIndex={canDrill ? 0 : undefined}
                  role={canDrill ? 'button' : undefined}
                  aria-expanded={canDrill ? isOpen : undefined}
                >
                  <td className='px-3 py-2'>
                    <div className='flex items-center gap-1.5'>
                      {canDrill && (
                        <ChevronRight
                          className={cn(
                            'size-3.5 shrink-0 transition-transform',
                            isOpen && 'rotate-90'
                          )}
                        />
                      )}
                      <span className='max-w-[220px] truncate font-medium'>
                        {rowLabel(row, t('(empty)'))}
                      </span>
                    </div>
                  </td>
                  <td className='px-3 py-2'>
                    <div className='flex items-center gap-2'>
                      <div className='bg-muted/60 h-2 w-20 overflow-hidden rounded-full'>
                        <div
                          className='bg-primary h-full rounded-full'
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <span className='text-muted-foreground tabular-nums'>
                        {share.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className='px-3 py-2 text-right font-mono tabular-nums'>
                    {formatLogQuota(row.quota)}
                  </td>
                  <td className='hidden px-3 py-2 text-right tabular-nums sm:table-cell'>
                    {formatNumber(row.prompt_tokens)}
                  </td>
                  <td className='hidden px-3 py-2 text-right tabular-nums sm:table-cell'>
                    {formatNumber(row.completion_tokens)}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums'>
                    {formatNumber(row.count)}
                  </td>
                </tr>
                {canDrill && isOpen && (
                  <tr className='border-t'>
                    <td colSpan={6} className='bg-muted/20 p-0'>
                      <DrillRows
                        dimension={props.dimension}
                        parentKey={row.key}
                        timeRange={props.timeRange}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TrendChart(props: {
  dimension: AttributionDimension
  timeRange: TimeRange
  themeReady: boolean
}) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()

  const { data, isLoading } = useQuery({
    queryKey: ['attribution-trend', props.dimension, props.timeRange],
    queryFn: async () => {
      const result = await getLogAttributionTrend({
        dimension: props.dimension,
        top: TREND_TOP,
        ...props.timeRange,
      })
      return result.success ? result.data : undefined
    },
    staleTime: 60_000,
  })

  const spec = useMemo(
    () =>
      data && data.buckets.length > 0
        ? buildAttributionTrendSpec(data, t)
        : null,
    [data, t]
  )

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
        <TrendingUp className='text-muted-foreground/60 size-4' />
        <div className='text-sm font-semibold'>{t('Daily Cost Trend')}</div>
      </div>
      <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
        {isLoading ? (
          <Skeleton className='h-full w-full' />
        ) : spec && props.themeReady ? (
          <VChart
            key={`attribution-trend-${props.dimension}-${resolvedTheme}`}
            spec={{
              ...spec,
              theme: resolvedTheme === 'dark' ? 'dark' : 'light',
              background: 'transparent',
            }}
            option={VCHART_OPTION}
          />
        ) : (
          <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
            {t('No data')}
          </div>
        )}
      </div>
    </div>
  )
}

export function AttributionCharts() {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const dimensionLabels = useDimensionLabels()

  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  const [dimension, setDimension] = useState<AttributionDimension>('token')
  const [topLimit, setTopLimit] = useState(20)
  const [selectedRange, setSelectedRange] = useState<number>(() =>
    getDefaultDays()
  )
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const { start, end } = getRollingDateRange(getDefaultDays())
    return {
      start_timestamp: Math.floor(start.getTime() / 1000),
      end_timestamp: Math.floor(end.getTime() / 1000),
    }
  })

  const handleRangeChange = useCallback((days: number) => {
    setSelectedRange(days)
    const { start, end } = getRollingDateRange(days)
    setTimeRange({
      start_timestamp: Math.floor(start.getTime() / 1000),
      end_timestamp: Math.floor(end.getTime() / 1000),
    })
  }, [])

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (m) => m.ThemeManager
        )
      }
      const ThemeManager = await themeManagerPromise
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }
    updateTheme()
  }, [resolvedTheme])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['attribution-ranking', dimension, timeRange],
    queryFn: async () => {
      const result = await getLogAttribution({
        dimension,
        top: RANKING_TOP,
        ...timeRange,
      })
      return result.success ? result.data : undefined
    },
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  })

  const total: AttributionTotal = data?.total ?? {
    quota: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    count: 0,
  }
  const rows = useMemo(
    () => (data?.rows ?? []).slice(0, topLimit),
    [data?.rows, topLimit]
  )

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-1.5 sm:gap-2'>
        <Tabs
          value={dimension}
          onValueChange={(value) =>
            setDimension(value as AttributionDimension)
          }
          className='shrink-0'
        >
          <TabsList>
            {DIMENSIONS.map((dim) => (
              <TabsTrigger key={dim} value={dim} className='px-2.5 text-xs'>
                {dimensionLabels[dim]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Tabs
          value={String(selectedRange)}
          onValueChange={(value) => handleRangeChange(Number(value))}
          className='shrink-0'
        >
          <TabsList>
            {TIME_RANGE_PRESETS.map((preset) => (
              <TabsTrigger
                key={preset.days}
                value={String(preset.days)}
                className='px-2.5 text-xs'
              >
                {t(preset.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Tabs
          value={String(topLimit)}
          onValueChange={(value) => setTopLimit(Number(value))}
          className='shrink-0'
        >
          <TabsList>
            <span className='text-muted-foreground px-2 text-xs font-medium whitespace-nowrap'>
              {t('Top {{count}}', { count: topLimit })}
            </span>
            {TOP_LIMIT_OPTIONS.map((limit) => (
              <TabsTrigger
                key={limit}
                value={String(limit)}
                className='px-2.5 text-xs'
              >
                {limit}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isFetching && (
          <Loader2 className='text-muted-foreground size-4 animate-spin' />
        )}
      </div>

      <SummaryCards total={total} loading={isLoading} />
      <TrendChart
        dimension={dimension}
        timeRange={timeRange}
        themeReady={themeReady}
      />
      <RankingTable
        dimension={dimension}
        rows={rows}
        total={total}
        loading={isLoading}
        timeRange={timeRange}
      />
    </div>
  )
}
