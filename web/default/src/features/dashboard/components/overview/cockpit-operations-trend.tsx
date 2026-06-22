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
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { opsLiveDataQueryOptions } from '@/lib/query-polling'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { useOpsRollingTimeRange } from '@/features/dashboard/hooks/use-ops-rolling-time-range'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import {
  OVERVIEW_MIDDLE_BODY_CLASS,
  OVERVIEW_MIDDLE_SECTION_HEADER_CLASS,
  OVERVIEW_MIDDLE_SECTION_TITLE_CLASS,
  OVERVIEW_SECTION_CLASS,
  OVERVIEW_TAB_ACTIVE_CLASS,
  OVERVIEW_TAB_INACTIVE_CLASS,
  OVERVIEW_TAB_LIST_CLASS,
} from './overview-reference-styles'
import { formatQuotaForCockpit } from './cockpit-display'
import { OverviewChartPlaceholder } from './overview-chart-placeholder'

type TrendTab = 'calls' | 'tokens' | 'success' | 'latency'

const HOUR_BUCKETS = 24

function buildHourlyMap(
  data: QuotaDataItem[],
  metric: 'count' | 'quota'
): Map<number, number> {
  const buckets = new Map<number, number>()
  for (const item of data) {
    const ts = Number(item.created_at) || 0
    const hourKey = Math.floor(ts / 3600) * 3600
    buckets.set(
      hourKey,
      (buckets.get(hourKey) ?? 0) +
        (Number(metric === 'count' ? item.count : item.quota) || 0)
    )
  }
  return buckets
}

function buildDualLineSeries(
  current: QuotaDataItem[],
  prior: QuotaDataItem[],
  end: number,
  metric: 'count' | 'quota'
) {
  const currentMap = buildHourlyMap(current, metric)
  const priorMap = buildHourlyMap(prior, metric)
  const points: {
    label: string
    current: number
    prior: number
  }[] = []

  for (let i = HOUR_BUCKETS - 1; i >= 0; i--) {
    const ts = end - i * 3600
    const hourKey = Math.floor(ts / 3600) * 3600
    const priorKey = hourKey - 86400
    const date = new Date(ts * 1000)
    points.push({
      label: `${String(date.getHours()).padStart(2, '0')}:00`,
      current: currentMap.get(hourKey) ?? 0,
      prior: priorMap.get(priorKey) ?? 0,
    })
  }

  return points
}

export function CockpitOperationsTrend() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)
  const [activeTab, setActiveTab] = useState<TrendTab>('calls')
  const summaryTimeRange = useOpsRollingTimeRange(1)

  const priorTimeRange = useMemo(
    () => ({
      start_timestamp: summaryTimeRange.start_timestamp - 86400,
      end_timestamp: summaryTimeRange.end_timestamp - 86400,
    }),
    [summaryTimeRange.end_timestamp, summaryTimeRange.start_timestamp]
  )

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

  const metricsQuery = useQuery({
    queryKey: ['perf-metrics-summary', 24],
    queryFn: () => getPerfMetricsSummary(24),
    staleTime: 60 * 1000,
    retry: false,
    enabled: isAdmin,
    ...opsLiveDataQueryOptions,
  })

  const items = usageTrendQuery.data?.data ?? []
  const priorItems = priorTrendQuery.data?.data ?? []
  const perfModels = metricsQuery.data?.data.models ?? []

  const chartData = useMemo(() => {
    if (activeTab === 'calls') {
      return buildDualLineSeries(
        items,
        priorItems,
        summaryTimeRange.end_timestamp,
        'count'
      )
    }
    if (activeTab === 'tokens') {
      return buildDualLineSeries(
        items,
        priorItems,
        summaryTimeRange.end_timestamp,
        'quota'
      )
    }
    return []
  }, [
    activeTab,
    items,
    priorItems,
    summaryTimeRange.end_timestamp,
  ])

  const tabs: {
    id: TrendTab
    label: string
    adminOnly?: boolean
  }[] = [
    { id: 'calls', label: t('Dashboard trend tab calls') },
    { id: 'tokens', label: t('Dashboard trend tab tokens') },
    { id: 'success', label: t('Dashboard trend tab success'), adminOnly: true },
    { id: 'latency', label: t('Dashboard trend tab latency'), adminOnly: true },
  ]

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin)
  const loading = usageTrendQuery.isLoading || priorTrendQuery.isLoading

  const perfSummary =
    activeTab === 'success'
      ? formatUptimePct(
          perfModels.length
            ? perfModels.reduce((s, m) => s + Number(m.success_rate || 0), 0) /
                perfModels.length
            : NaN
        )
      : activeTab === 'latency'
        ? formatLatency(
            perfModels.length
              ? Math.round(
                  perfModels.reduce(
                    (s, m) => s + Number(m.avg_latency_ms || 0),
                    0
                  ) / perfModels.length
                )
              : NaN
          )
        : null

  const hasChartData = chartData.some((p) => p.current > 0 || p.prior > 0)

  const handleExport = () => {
    if (!hasChartData) return
    const header = 'hour,current,prior\n'
    const rows = chartData
      .map((p) => `${p.label},${p.current},${p.prior}`)
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ops-trend-${activeTab}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className={cn(OVERVIEW_SECTION_CLASS, 'flex h-full flex-col')}>
      <div className={OVERVIEW_MIDDLE_SECTION_HEADER_CLASS}>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <h3 className={OVERVIEW_MIDDLE_SECTION_TITLE_CLASS}>
            {t('Dashboard operations trend title')}
          </h3>
          <div className={OVERVIEW_TAB_LIST_CLASS}>
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type='button'
                onClick={() => setActiveTab(tab.id)}
                className={
                  activeTab === tab.id
                    ? OVERVIEW_TAB_ACTIVE_CLASS
                    : OVERVIEW_TAB_INACTIVE_CLASS
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className='flex items-center gap-1.5'>
          <span className='inline-flex h-8 items-center rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[12px] font-medium text-[#374151] shadow-sm'>
            {t('Dashboard time range 24h')}
          </span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8 gap-1.5 border-[#E5E7EB] bg-white px-3 text-[12px] text-[#374151] shadow-sm'
            disabled={!hasChartData || activeTab === 'success' || activeTab === 'latency'}
            onClick={handleExport}
          >
            <Download className='size-3.5' aria-hidden='true' />
            {t('Export')}
          </Button>
        </div>
      </div>

      <div className={OVERVIEW_MIDDLE_BODY_CLASS}>
        {loading ? (
          <Skeleton className='h-full w-full rounded-md bg-slate-100' />
        ) : activeTab === 'success' || activeTab === 'latency' ? (
          <div className='flex h-full flex-col items-center justify-center gap-1.5 text-center'>
            <p className='font-[DIN,sans-serif] text-[26px] font-bold leading-none text-[#111827]'>
              {perfSummary}
            </p>
            <p className='text-[12px] text-[#9CA3AF]'>{t('Dashboard KPI perf 24h')}</p>
            {perfModels.length === 0 ? (
              <p className='text-[11px] text-[#C4CBD4]'>
                {metricsQuery.isError
                  ? t('Dashboard perf metrics unavailable')
                  : t('No data available')}
              </p>
            ) : null}
          </div>
        ) : !hasChartData ? (
          <OverviewChartPlaceholder
            description={t('Dashboard operations trend description')}
          />
        ) : (
          <ResponsiveContainer width='100%' height='100%'>
            <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id='trendCurrentFill' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='#2563EB' stopOpacity={0.15} />
                  <stop offset='100%' stopColor='#2563EB' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke='#E5E7EB' strokeDasharray='3 3' vertical={false} />
              <XAxis
                dataKey='label'
                tick={{ fill: '#64748B', fontSize: 10 }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickLine={false}
                interval='preserveStartEnd'
              />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v) =>
                  activeTab === 'tokens'
                    ? formatQuotaForCockpit(Number(v))
                    : formatNumber(Number(v))
                }
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  background: '#fff',
                  fontSize: 12,
                }}
                formatter={(value, name) => [
                  activeTab === 'tokens'
                    ? formatQuotaForCockpit(Number(value))
                    : formatNumber(Number(value)),
                  name === 'current'
                    ? t('Dashboard trend legend current')
                    : t('Dashboard trend legend prior'),
                ]}
              />
              <Legend
                verticalAlign='top'
                align='right'
                iconType='circle'
                wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
                formatter={(value) =>
                  value === 'current'
                    ? t('Dashboard trend legend current')
                    : t('Dashboard trend legend prior')
                }
              />
              <Area
                type='monotone'
                dataKey='current'
                stroke='none'
                fill='url(#trendCurrentFill)'
              />
              <Line
                type='monotone'
                dataKey='current'
                stroke='#2563EB'
                strokeWidth={2}
                dot={{ r: 3, fill: '#2563EB', strokeWidth: 0 }}
                activeDot={{ r: 4, fill: '#2563EB' }}
              />
              <Line
                type='monotone'
                dataKey='prior'
                stroke='#22C55E'
                strokeWidth={2}
                dot={{ r: 3, fill: '#22C55E', strokeWidth: 0 }}
                activeDot={{ r: 4, fill: '#22C55E' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
