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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { useThemeRadiusPx } from '@/lib/theme-radius'
import { cn } from '@/lib/utils'
import { ChartContainer } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import type { LatencyTimePoint, UptimeDayPoint } from '../lib/mock-stats'

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

// ---------------------------------------------------------------------------
// Latency trend chart (24h, multi-group point-line chart)
// ---------------------------------------------------------------------------

const LATENCY_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function LatencyTrendChart(props: {
  series: LatencyTimePoint[]
  className?: string
}) {
  const { t } = useTranslation()

  const { wideRows, groups } = useMemo(() => {
    if (props.series.length === 0) return { wideRows: [], groups: [] }
    const groupSet = new Set<string>()
    const map = new Map<string, Record<string, string | number>>()
    for (const p of props.series) {
      const time = formatHourLabel(p.timestamp)
      groupSet.add(p.group)
      if (!map.has(time)) map.set(time, { time })
      map.get(time)![p.group] = p.ttft_ms
    }
    return {
      wideRows: Array.from(map.values()),
      groups: Array.from(groupSet),
    }
  }, [props.series])

  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {}
    groups.forEach((g, i) => {
      cfg[g] = { label: g, color: LATENCY_COLORS[i % LATENCY_COLORS.length] }
    })
    return cfg
  }, [groups])

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
    <div className={cn('h-64 sm:h-72', props.className)}>
      <ChartContainer config={chartConfig} className='h-full w-full'>
        <LineChart data={wideRows} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-border/40' vertical={false} />
          <XAxis
            dataKey='time'
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval='preserveStartEnd'
          />
          <YAxis
            tickFormatter={(v) => `${v} ms`}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className='border-border/50 bg-background grid min-w-36 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'>
                  <div className='text-muted-foreground font-medium'>{label}</div>
                  {payload.map((p, i) => (
                    <div key={i} className='flex items-center gap-2'>
                      <div className='h-2 w-2 shrink-0 rounded-full' style={{ backgroundColor: p.color }} />
                      <div className='flex flex-1 justify-between gap-3'>
                        <span className='text-muted-foreground'>{p.name}</span>
                        <span className='font-mono tabular-nums'>{Math.round(Number(p.value))} ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          {groups.map((g, i) => (
            <Line
              key={g}
              type='monotone'
              dataKey={g}
              stroke={LATENCY_COLORS[i % LATENCY_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: LATENCY_COLORS[i % LATENCY_COLORS.length] }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Uptime trend chart (single-series line with conditional dot colors)
// ---------------------------------------------------------------------------

function uptimeColor(pct: number): string {
  if (pct >= 99.9) return '#10b981'
  if (pct >= 99.0) return '#f59e0b'
  return '#ef4444'
}

const UPTIME_CHART_CONFIG: ChartConfig = {
  uptime: { label: 'Uptime', color: '#10b981' },
}

export function UptimeTrendChart(props: {
  series: UptimeDayPoint[]
  className?: string
}) {
  const { t } = useTranslation()

  const data = useMemo(
    () =>
      props.series.map((p) => ({
        date: formatDayLabel(p.date),
        uptime: p.uptime_pct,
        incidents: p.incidents,
        outage: p.outage_minutes,
        dotColor: uptimeColor(p.uptime_pct),
      })),
    [props.series]
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
    <div className={cn('h-56 sm:h-64', props.className)}>
      <ChartContainer config={UPTIME_CHART_CONFIG} className='h-full w-full'>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-border/40' vertical={false} />
          <XAxis
            dataKey='date'
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval='preserveStartEnd'
          />
          <YAxis
            domain={[95, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={42}
          />
          <ReferenceLine y={99.9} stroke='#10b981' strokeDasharray='3 3' strokeOpacity={0.5} />
          <ReferenceLine y={99.0} stroke='#f59e0b' strokeDasharray='3 3' strokeOpacity={0.5} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload as typeof data[number]
              return (
                <div className='border-border/50 bg-background grid min-w-36 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'>
                  <div className='text-muted-foreground font-medium'>{label}</div>
                  <div className='flex justify-between gap-4'>
                    <span className='text-muted-foreground'>{t('Uptime')}</span>
                    <span className='font-mono tabular-nums'>{d.uptime.toFixed(2)}%</span>
                  </div>
                  <div className='flex justify-between gap-4'>
                    <span className='text-muted-foreground'>{t('Incidents')}</span>
                    <span className='font-mono tabular-nums'>{d.incidents}</span>
                  </div>
                  <div className='flex justify-between gap-4'>
                    <span className='text-muted-foreground'>{t('Outage')}</span>
                    <span className='font-mono tabular-nums'>{d.outage} {t('minutes')}</span>
                  </div>
                </div>
              )
            }}
          />
          <Line
            type='monotone'
            dataKey='uptime'
            stroke='#10b981'
            strokeWidth={2}
            isAnimationActive={false}
            dot={(dotProps) => {
              const { cx, cy, payload } = dotProps as { cx: number; cy: number; payload: typeof data[number] }
              return (
                <circle
                  key={`dot-${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={payload.dotColor}
                  stroke='#ffffff'
                  strokeWidth={1.5}
                />
              )
            }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Throughput by group (horizontal bar)
// ---------------------------------------------------------------------------

const THROUGHPUT_CONFIG: ChartConfig = {
  throughput_tps: { label: 'Throughput', color: '#6366f1' },
}

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

  if (filtered.length === 0) return null

  const radius = barRadius ?? 4

  return (
    <div className={cn('h-48 sm:h-56', props.className)}>
      <ChartContainer config={THROUGHPUT_CONFIG} className='h-full w-full'>
        <BarChart
          data={filtered}
          layout='vertical'
          margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray='3 3' className='stroke-border/40' horizontal={false} />
          <XAxis
            type='number'
            tickFormatter={(v) => `${v}`}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type='category'
            dataKey='group'
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className='border-border/50 bg-background grid min-w-32 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'>
                  <div className='text-muted-foreground font-medium'>{label}</div>
                  <div className='flex justify-between gap-4'>
                    <span className='text-muted-foreground'>{t('Throughput')}</span>
                    <span className='font-mono tabular-nums'>
                      {Number(payload[0]?.value).toFixed(1)} t/s
                    </span>
                  </div>
                </div>
              )
            }}
          />
          <Bar
            dataKey='throughput_tps'
            radius={radius}
            isAnimationActive={false}
            label={{
              position: 'right',
              fontSize: 11,
              formatter: (v: unknown) => `${Number(v).toFixed(1)} t/s`,
            }}
          >
            {filtered.map((_, i) => (
              <Cell key={i} fill='#6366f1' />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}
