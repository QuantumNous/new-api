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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import {
  Coins,
  Loader2,
  type LucideIcon,
  Network,
  Percent,
  PiggyBank,
  Receipt,
  TrendingUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { getRollingDateRange, type TimeGranularity } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { getChannelQuotaDates } from '@/features/dashboard/api'
import {
  TIME_GRANULARITY_OPTIONS,
  TIME_RANGE_PRESETS,
} from '@/features/dashboard/constants'
import { processUserChartData } from '@/features/dashboard/lib'
import type {
  ProcessedUserChartData,
  QuotaDataItem,
} from '@/features/dashboard/types'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

const TOP_OPTIONS = [5, 10, 20, 50]

const CHANNEL_CHARTS: {
  value: string
  labelKey: string
  specKey: keyof ProcessedUserChartData
  icon: LucideIcon
}[] = [
  {
    value: 'rank',
    labelKey: 'Channel Cost Ranking',
    specKey: 'spec_user_rank',
    icon: Network,
  },
  {
    value: 'trend',
    labelKey: 'Cost Trend',
    specKey: 'spec_user_trend',
    icon: TrendingUp,
  },
]

export function ChannelCharts() {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  const [selectedRange, setSelectedRange] = useState<number>(1)
  const [timeGranularity, setTimeGranularity] =
    useState<TimeGranularity>('hour')
  const [topN, setTopN] = useState<number>(10)
  const [timeRange, setTimeRange] = useState(() => {
    const { start, end } = getRollingDateRange(1)
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

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'channel-quota', timeRange],
    queryFn: () => getChannelQuotaDates(timeRange),
    select: (res) => (res.success ? res.data : null),
    staleTime: 60_000,
  })

  // 把渠道时间序列映射成 QuotaDataItem（渠道名 → username，渠道成本 → quota），
  // 复用用户统计页的图表处理逻辑。
  const { mappedData, totals } = useMemo(() => {
    const points = data?.points ?? []
    const channels = data?.channels ?? []
    const nameById = new Map(
      channels.map((c) => [c.channel_id, c.channel_name || `#${c.channel_id}`])
    )
    const mapped: QuotaDataItem[] = points.map((p) => ({
      username: nameById.get(p.channel_id) || `#${p.channel_id}`,
      created_at: p.created_at,
      quota: p.channel_quota ?? 0,
      count: p.count ?? 0,
    }))
    const totals = points.reduce(
      (acc, p) => {
        acc.quota += p.quota ?? 0
        acc.channelQuota += p.channel_quota ?? 0
        return acc
      },
      { quota: 0, channelQuota: 0 }
    )
    return { mappedData: mapped, totals }
  }, [data])

  const chartData = useMemo(() => {
    const cd = processUserChartData(
      isLoading ? [] : mappedData,
      timeGranularity,
      t,
      topN,
      customization.preset
    )
    // 复用用户统计页的图表，覆盖标题为渠道维度的措辞
    cd.spec_user_rank.title = {
      ...cd.spec_user_rank.title,
      text: t('Channel Cost Ranking'),
    }
    cd.spec_user_trend.title = {
      ...cd.spec_user_trend.title,
      text: t('Cost Trend'),
    }
    return cd
  }, [mappedData, isLoading, timeGranularity, t, topN, customization.preset])

  const summaryCards: { title: string; value: string; icon: LucideIcon }[] = [
    {
      title: t('Total Channel Cost'),
      value: formatQuota(totals.channelQuota),
      icon: Coins,
    },
    {
      title: t('Total Raw Cost'),
      value: formatQuota(totals.quota),
      icon: Receipt,
    },
    {
      title: t('Overall Ratio'),
      value:
        totals.quota !== 0
          ? `${(totals.channelQuota / totals.quota).toFixed(2)}x`
          : '-',
      icon: Percent,
    },
    {
      title: t('Saved'),
      value: formatQuota(totals.quota - totals.channelQuota),
      icon: PiggyBank,
    },
  ]

  const groupCls = 'flex shrink-0 items-center gap-1.5 rounded-lg border p-0.5'
  const btnCls = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
      active
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`

  return (
    <div className='space-y-3'>
      {/* 控件栏 */}
      <div className='flex flex-wrap items-center gap-1.5 sm:gap-2'>
        <div className={groupCls}>
          {TIME_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              type='button'
              onClick={() => handleRangeChange(preset.days)}
              className={btnCls(selectedRange === preset.days)}
            >
              {t(preset.label)}
            </button>
          ))}
        </div>

        <div className={groupCls}>
          {TIME_GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type='button'
              onClick={() => setTimeGranularity(opt.value)}
              className={btnCls(timeGranularity === opt.value)}
            >
              {t(opt.label)}
            </button>
          ))}
        </div>

        <div className={groupCls}>
          <span className='text-muted-foreground px-2 text-xs font-medium'>
            {t('Top Channels')}
          </span>
          {TOP_OPTIONS.map((n) => (
            <button
              key={n}
              type='button'
              onClick={() => setTopN(n)}
              className={btnCls(topN === n)}
            >
              {t('Top {{count}}', { count: n })}
            </button>
          ))}
        </div>

        {isLoading && (
          <Loader2 className='text-muted-foreground size-4 animate-spin' />
        )}
      </div>

      {/* 概览卡片 */}
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title} className='rounded-lg border p-4'>
              <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
                <Icon className='text-muted-foreground/60 size-3.5 shrink-0' />
                <span className='truncate'>{card.title}</span>
              </div>
              {isLoading ? (
                <Skeleton className='mt-2 h-7 w-20' />
              ) : (
                <div className='text-foreground mt-1.5 font-mono text-xl font-semibold tabular-nums sm:text-2xl'>
                  {card.value}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 图表（抄用户统计页） */}
      <div className='grid gap-3'>
        {CHANNEL_CHARTS.map((chart) => {
          const Icon = chart.icon
          const spec = chartData[chart.specKey]
          return (
            <div
              key={chart.value}
              className='overflow-hidden rounded-lg border'
            >
              <div className='flex w-full items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
                <Icon className='text-muted-foreground/60 size-4' />
                <div className='text-sm font-semibold'>{t(chart.labelKey)}</div>
              </div>
              <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
                {isLoading ? (
                  <Skeleton className='h-full w-full' />
                ) : (
                  themeReady &&
                  spec && (
                    <VChart
                      key={`channel-${chart.value}-${topN}-${resolvedTheme}-${customization.preset}`}
                      spec={{
                        ...spec,
                        theme: resolvedTheme === 'dark' ? 'dark' : 'light',
                        background: 'transparent',
                      }}
                      option={VCHART_OPTION}
                    />
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
