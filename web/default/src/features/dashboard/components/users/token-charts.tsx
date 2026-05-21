import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import { Zap, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getNormalizedDateRange } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'
import { useTheme } from '@/context/theme-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { getTokenStats } from '@/features/dashboard/api'
import { TIME_RANGE_PRESETS } from '@/features/dashboard/constants'
import {
  getDefaultDays,
  getSavedGranularity,
  processTokenChartData,
} from '@/features/dashboard/lib'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

const TOP_USER_LIMIT_OPTIONS = [5, 10, 20, 50]

export function TokenCharts() {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  const [selectedRange, setSelectedRange] = useState<number>(() =>
    getDefaultDays(getSavedGranularity())
  )
  const [topUserLimit, setTopUserLimit] = useState(10)
  const [timeRange, setTimeRange] = useState(() => {
    const days = getDefaultDays(getSavedGranularity())
    const { start, end } = getNormalizedDateRange(days)
    return {
      start_timestamp: Math.floor(start.getTime() / 1000),
      end_timestamp: Math.floor(end.getTime() / 1000),
    }
  })

  const handleRangeChange = useCallback((days: number) => {
    setSelectedRange(days)
    const { start, end } = getNormalizedDateRange(days)
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

  const { data: tokenData, isLoading } = useQuery({
    queryKey: ['dashboard', 'token-stats', timeRange],
    queryFn: () => getTokenStats(timeRange),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })

  const chartData = useMemo(
    () =>
      processTokenChartData(
        isLoading ? [] : (tokenData ?? []),
        t,
        topUserLimit
      ),
    [tokenData, isLoading, t, topUserLimit]
  )

  return (
    <div className='space-y-4'>
      {/* Toolbar: time range presets + granularity */}
      <div className='flex flex-wrap items-center gap-2'>
        <div className='flex items-center gap-1.5 rounded-md border p-0.5'>
          {TIME_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              type='button'
              onClick={() => handleRangeChange(preset.days)}
              className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedRange === preset.days
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t(preset.label)}
            </button>
          ))}
        </div>

        <div className='flex items-center gap-1.5 rounded-md border p-0.5'>
          <span className='text-muted-foreground px-2 text-xs font-medium'>
            {t('Top Users')}
          </span>
          {TOP_USER_LIMIT_OPTIONS.map((limit) => (
            <button
              key={limit}
              type='button'
              onClick={() => setTopUserLimit(limit)}
              className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors ${
                topUserLimit === limit
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t('Top {{count}}', { count: limit })}
            </button>
          ))}
        </div>

        {isLoading && (
          <Loader2 className='text-muted-foreground size-4 animate-spin' />
        )}
      </div>

      {/* Stacked Bar Chart */}
      <div className='overflow-hidden rounded-lg border'>
        <div className='flex w-full items-center gap-2 border-b px-4 py-3 sm:px-5'>
          <Zap className='text-muted-foreground/60 size-4' />
          <div className='text-sm font-semibold'>
            {t('Token Consumption Ranking')}
          </div>
        </div>

        <div className='h-96 p-2'>
          {isLoading ? (
            <Skeleton className='h-full w-full' />
          ) : (
            themeReady &&
            chartData.spec_token_stacked && (
              <VChart
                key={`token-stacked-${topUserLimit}-${resolvedTheme}`}
                spec={{
                  ...chartData.spec_token_stacked,
                  theme: resolvedTheme === 'dark' ? 'dark' : 'light',
                  background: 'transparent',
                }}
                option={VCHART_OPTION}
              />
            )
          )}
        </div>
      </div>
    </div>
  )
}
