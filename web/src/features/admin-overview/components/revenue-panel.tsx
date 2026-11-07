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
import { ArrowDownIcon, ArrowUpIcon, CircleDollarSign } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TitledCard } from '@/components/ui/titled-card'
import {
  formatCompactNumber,
  formatLogQuota,
  formatPercent,
} from '@/lib/format'

import type { DailyRevenuePoint, MonthlyRevenuePoint } from '../types'

type ChartView = 'daily' | 'monthly'

export interface RevenuePanelProps {
  points: DailyRevenuePoint[]
  monthlyPoints: MonthlyRevenuePoint[]
  revenueToday: number
  revenueMonth: number
  revenueAllTime: number | null
  revenueYesterday: number | undefined
  daysElapsed: number
  loading: boolean
}

const MONTHS_SHOWN = 2

export function RevenuePanel(props: RevenuePanelProps) {
  const { t } = useTranslation()
  const [view, setView] = useState<ChartView>('daily')
  const hasData =
    props.points.some((point) => point.quota > 0) ||
    props.monthlyPoints.some((point) => point.quota > 0)

  const dayOverDayDelta =
    props.revenueYesterday != null
      ? props.revenueToday - props.revenueYesterday
      : undefined
  const dayOverDayPercent =
    props.revenueYesterday != null && props.revenueYesterday > 0
      ? ((props.revenueToday - props.revenueYesterday) /
          props.revenueYesterday) *
        100
      : undefined

  const description =
    view === 'monthly'
      ? t('Revenue over the last {{count}} months', { count: MONTHS_SHOWN })
      : t('Revenue over the last 30 days')

  const chartConfig = {
    quota: {
      label: t('Revenue'),
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  let chartContent: ReactNode
  if (props.loading) {
    chartContent = <Skeleton className='h-full w-full' />
  } else if (!hasData) {
    chartContent = <EmptyChart />
  } else if (view === 'monthly') {
    chartContent = (
      <MonthlyChart points={props.monthlyPoints} chartConfig={chartConfig} />
    )
  } else {
    chartContent = (
      <DailyChart points={props.points} chartConfig={chartConfig} />
    )
  }

  return (
    <TitledCard
      title={t('Sales & Revenue')}
      description={description}
      icon={<CircleDollarSign />}
      iconTone='success'
      action={
        <div className='text-end'>
          <div className='text-muted-foreground text-[11px]'>
            {t('Revenue this month')}
          </div>
          <div className='font-mono text-sm font-semibold tabular-nums'>
            {formatLogQuota(props.revenueMonth)}
          </div>
        </div>
      }
    >
      <div className='flex flex-col gap-4'>
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as ChartView)}
          className='w-fit'
        >
          <TabsList>
            <TabsTrigger value='daily'>{t('Daily')}</TabsTrigger>
            <TabsTrigger value='monthly'>{t('Monthly')}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className='h-56 w-full'>{chartContent}</div>

        <dl className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
          <SummaryCell
            label={t('Today')}
            value={formatLogQuota(props.revenueToday)}
            sub={
              dayOverDayDelta !== undefined ? (
                <RevenueTrend
                  delta={dayOverDayDelta}
                  percent={dayOverDayPercent}
                />
              ) : (
                <span className='text-muted-foreground text-[11px]'>
                  {t('vs yesterday')}
                </span>
              )
            }
          />
          <SummaryCell
            label={t('This month')}
            value={formatLogQuota(props.revenueMonth)}
          />
          <SummaryCell
            label={t('Daily average')}
            value={formatLogQuota(props.revenueMonth / props.daysElapsed)}
          />
          <SummaryCell
            label={t('All time')}
            value={
              props.revenueAllTime == null
                ? '-'
                : formatLogQuota(props.revenueAllTime)
            }
          />
        </dl>

        <p className='text-muted-foreground text-[11px]'>
          {t('Usage data may lag by a few minutes')}
        </p>
      </div>
    </TitledCard>
  )
}

function RevenueTrend(props: { delta: number; percent?: number }) {
  const isPositive = props.delta >= 0
  const color = isPositive ? 'text-success' : 'text-destructive'
  const Arrow = isPositive ? ArrowUpIcon : ArrowDownIcon
  const sign = props.delta > 0 ? '+' : ''

  return (
    <div className='flex items-center gap-1.5'>
      <Arrow className={`size-3.5 shrink-0 ${color}`} aria-hidden='true' />
      <span className={`text-[11px] font-semibold tabular-nums ${color}`}>
        {sign}
        {formatLogQuota(props.delta)}
      </span>
      {props.percent != null && (
        <span className='text-muted-foreground text-[11px] tabular-nums'>
          ({sign}
          {formatPercent(Math.abs(props.percent))})
        </span>
      )}
    </div>
  )
}

function SummaryCell(props: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className='bg-muted/40 rounded-lg px-2.5 py-2'>
      <dt className='text-muted-foreground truncate text-[11px] font-medium'>
        {props.label}
      </dt>
      <dd className='mt-1 truncate font-mono text-xs font-semibold tabular-nums'>
        {props.value}
      </dd>
      {props.sub != null && <div className='mt-1 text-[11px]'>{props.sub}</div>}
    </div>
  )
}

function DailyChart({
  points,
  chartConfig,
}: {
  points: DailyRevenuePoint[]
  chartConfig: ChartConfig
}) {
  return (
    <ChartContainer config={chartConfig} className='aspect-auto h-full w-full'>
      <AreaChart
        data={points}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id='revenueDailyGradient' x1='0' y1='0' x2='0' y2='1'>
            <stop
              offset='5%'
              stopColor='var(--color-quota)'
              stopOpacity={0.6}
            />
            <stop
              offset='95%'
              stopColor='var(--color-quota)'
              stopOpacity={0.04}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray='3 3' />
        <XAxis
          dataKey='label'
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value) => formatCompactNumber(Number(value))}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--border)' }}
          content={
            <ChartTooltipContent
              formatter={(value) => formatLogQuota(Number(value))}
            />
          }
        />
        <Area
          type='monotone'
          dataKey='quota'
          stroke='var(--color-quota)'
          fill='url(#revenueDailyGradient)'
          strokeWidth={2}
          animationDuration={450}
          animationEasing='ease-out'
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}

function MonthlyChart({
  points,
  chartConfig,
}: {
  points: MonthlyRevenuePoint[]
  chartConfig: ChartConfig
}) {
  return (
    <ChartContainer config={chartConfig} className='aspect-auto h-full w-full'>
      <LineChart
        data={points}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray='3 3' />
        <XAxis
          dataKey='label'
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value) => formatCompactNumber(Number(value))}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => formatLogQuota(Number(value))}
            />
          }
        />
        <Line
          type='monotone'
          dataKey='quota'
          stroke='var(--color-quota)'
          strokeWidth={2.5}
          dot={{ r: 4, strokeWidth: 2 }}
          activeDot={{ r: 5, strokeWidth: 2 }}
          animationDuration={450}
          animationEasing='ease-out'
        />
      </LineChart>
    </ChartContainer>
  )
}

function EmptyChart() {
  const { t } = useTranslation()
  return (
    <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
      {t('No data available')}
    </div>
  )
}
