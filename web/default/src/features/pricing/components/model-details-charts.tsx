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
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { getSuccessRateColor } from '@/features/performance-metrics/lib/format'
import { useThemeRadiusPx } from '@/lib/theme-radius'
import { cn } from '@/lib/utils'

import type { LatencyTimePoint, UptimeDayPoint } from '../lib/mock-stats'

const CHART_FRAME_CLASS =
  'bg-card ring-foreground/10 overflow-hidden rounded-xl p-3 ring-1'

const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  '#6366f1',
  '#14b8a6',
  '#f97316',
]

function formatHourLabel(iso: string): string {
  const date = new Date(iso)
  const hours = date.getHours()
  return `${String(hours).padStart(2, '0')}:00`
}

function formatDayLabel(date: string): string {
  const parsed = new Date(date)
  if (date.includes('T')) {
    return parsed.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
    })
  }
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

const UPTIME_AXIS_MAX = 100
const UPTIME_FOCUSED_AXIS_MIN = 95
const UPTIME_MINOR_OUTAGE_AXIS_MIN = 90

function toUptimeChartValue(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(UPTIME_AXIS_MAX, Math.max(0, value))
}

function getUptimeAxisMin(values: number[]): number {
  const finiteValues = values.filter((value) => Number.isFinite(value))
  if (finiteValues.length === 0) return UPTIME_FOCUSED_AXIS_MIN

  const minValue = Math.max(0, Math.min(...finiteValues))
  if (minValue >= UPTIME_FOCUSED_AXIS_MIN) return UPTIME_FOCUSED_AXIS_MIN
  if (minValue >= UPTIME_MINOR_OUTAGE_AXIS_MIN) {
    return UPTIME_MINOR_OUTAGE_AXIS_MIN
  }

  return Math.max(0, Math.floor((minValue - 5) / 10) * 10)
}

// ---------------------------------------------------------------------------
// Latency trend chart (24h, multi-group line chart)
// ---------------------------------------------------------------------------

type LatencyRow = Record<string, number | string> & { time: string }

export function LatencyTrendChart(props: {
  series: LatencyTimePoint[]
  className?: string
}) {
  const { t } = useTranslation()

  const chart = useMemo(() => {
    const rowsByTime = new Map<string, LatencyRow>()
    const groups: string[] = []

    for (const point of props.series) {
      const time = formatHourLabel(point.timestamp)
      let row = rowsByTime.get(time)
      if (!row) {
        row = { time }
        rowsByTime.set(time, row)
      }
      row[point.group] = point.ttft_ms
      if (!groups.includes(point.group)) groups.push(point.group)
    }

    const config: ChartConfig = {}
    groups.forEach((group, index) => {
      config[group] = {
        label: group,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      }
    })

    return { rows: [...rowsByTime.values()], groups, config }
  }, [props.series])

  if (props.series.length === 0) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex h-48 items-center justify-center rounded-lg border text-xs',
          props.className
        )}
      >
        {t('No latency data available')}
      </div>
    )
  }

  return (
    <div className={cn(CHART_FRAME_CLASS, props.className)}>
      <ChartContainer
        config={chart.config}
        className='aspect-auto h-64 w-full sm:h-72'
      >
        <LineChart data={chart.rows} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray='3 3' />
          <XAxis
            dataKey='time'
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value) => `${value} ms`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => (
                  <>
                    <div
                      className='size-2.5 shrink-0 rounded-[2px]'
                      style={{ backgroundColor: item.color }}
                    />
                    <span className='text-muted-foreground flex-1'>{name}</span>
                    <span className='text-foreground font-mono font-medium tabular-nums'>
                      {`${Math.round(Number(value) || 0)} ms`}
                    </span>
                  </>
                )}
              />
            }
          />
          {chart.groups.map((group, index) => (
            <Line
              key={group}
              type='monotone'
              dataKey={group}
              name={group}
              stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 1.5 }}
              isAnimationActive
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Uptime trend chart (point-line chart, dots coloured by success level)
// ---------------------------------------------------------------------------

type UptimeRow = {
  date: string
  uptime: number
  incidents: number
  outage: number
}

function UptimeDot(dotProps: DotItemDotProps) {
  const row = dotProps.payload as UptimeRow | undefined
  if (typeof dotProps.cx !== 'number' || typeof dotProps.cy !== 'number') {
    return null
  }
  return (
    <circle
      cx={dotProps.cx}
      cy={dotProps.cy}
      r={3}
      fill={getSuccessRateColor(row?.uptime ?? 0)}
      stroke='#ffffff'
      strokeWidth={1.5}
    />
  )
}

export function UptimeTrendChart(props: {
  series: UptimeDayPoint[]
  className?: string
}) {
  const { t } = useTranslation()

  const chart = useMemo(() => {
    const rows: UptimeRow[] = props.series.map((point) => ({
      date: formatDayLabel(point.date),
      uptime: toUptimeChartValue(point.uptime_pct),
      incidents: point.incidents,
      outage: point.outage_minutes,
    }))
    return {
      rows,
      axisMin: getUptimeAxisMin(rows.map((row) => row.uptime)),
    }
  }, [props.series])

  const config = useMemo(
    () => ({ uptime: { label: t('Uptime'), color: '#10b981' } }) as ChartConfig,
    [t]
  )

  if (props.series.length === 0) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex h-48 items-center justify-center rounded-lg border text-xs',
          props.className
        )}
      >
        {t('No uptime data available')}
      </div>
    )
  }

  return (
    <div className={cn(CHART_FRAME_CLASS, props.className)}>
      <ChartContainer
        config={config}
        className='aspect-auto h-56 w-full sm:h-64'
      >
        <LineChart data={chart.rows} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray='3 3' />
          <XAxis
            dataKey='date'
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            domain={[chart.axisMin, UPTIME_AXIS_MAX]}
            tickFormatter={(value) => `${value}%`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(_value, _name, item) => {
                  const row = item.payload as UptimeRow
                  return (
                    <div className='grid flex-1 gap-1'>
                      <div className='flex items-center justify-between gap-4'>
                        <span className='text-muted-foreground'>
                          {t('Uptime')}
                        </span>
                        <span className='text-foreground font-mono font-medium tabular-nums'>
                          {`${row.uptime.toFixed(2)}%`}
                        </span>
                      </div>
                      <div className='flex items-center justify-between gap-4'>
                        <span className='text-muted-foreground'>
                          {t('Incidents')}
                        </span>
                        <span className='text-foreground font-mono font-medium tabular-nums'>
                          {row.incidents}
                        </span>
                      </div>
                      <div className='flex items-center justify-between gap-4'>
                        <span className='text-muted-foreground'>
                          {t('Outage')}
                        </span>
                        <span className='text-foreground font-mono font-medium tabular-nums'>
                          {`${row.outage} ${t('minutes')}`}
                        </span>
                      </div>
                    </div>
                  )
                }}
              />
            }
          />
          <Line
            type='monotone'
            dataKey='uptime'
            name={t('Uptime')}
            stroke='#10b981'
            strokeWidth={2}
            dot={UptimeDot}
            activeDot={{ r: 4, strokeWidth: 1.5 }}
            isAnimationActive
          />
        </LineChart>
      </ChartContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Throughput by group (horizontal bar)
// ---------------------------------------------------------------------------

export function ThroughputBarChart(props: {
  rows: { group: string; throughput_tps: number }[]
  className?: string
}) {
  const { t } = useTranslation()
  const { customization } = useThemeCustomization()
  const barRadius = useThemeRadiusPx(
    '--radius-sm',
    `${customization.preset}:${customization.radius}`
  )

  const filtered = useMemo(
    () => props.rows.filter((r) => r.throughput_tps > 0),
    [props.rows]
  )

  const config = useMemo(
    () =>
      ({
        throughput_tps: { label: t('Throughput'), color: '#6366f1' },
      }) as ChartConfig,
    [t]
  )

  if (filtered.length === 0) {
    return null
  }

  return (
    <div className={cn(CHART_FRAME_CLASS, props.className)}>
      <ChartContainer
        config={config}
        className='aspect-auto h-48 w-full sm:h-56'
      >
        <BarChart
          data={filtered}
          layout='vertical'
          margin={{ left: 4, right: 48, top: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray='3 3' />
          <YAxis
            dataKey='group'
            type='category'
            tickLine={false}
            axisLine={false}
            width={96}
          />
          <XAxis type='number' tickLine={false} axisLine={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <span className='text-foreground font-mono font-medium tabular-nums'>
                    {`${(Number(value) || 0).toFixed(1)} t/s`}
                  </span>
                )}
              />
            }
          />
          <Bar
            dataKey='throughput_tps'
            name={t('Throughput')}
            fill='#6366f1'
            radius={barRadius ?? 3}
            isAnimationActive
          >
            <LabelList
              dataKey='throughput_tps'
              position='right'
              className='fill-muted-foreground text-[11px] tabular-nums'
              formatter={(value) => `${Number(value) || 0} t/s`}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}
