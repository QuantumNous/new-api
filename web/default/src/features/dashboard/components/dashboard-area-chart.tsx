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
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
} from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import type { AreaChartSeries } from '@/features/dashboard/types'

function sanitizeKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

interface AreaTooltipPayloadItem {
  dataKey: string
  value: number
  color: string
  name: string
}

interface AreaTooltipProps {
  active?: boolean
  payload?: AreaTooltipPayloadItem[]
  label?: string
  formatValue?: (v: number) => string
  otherLabel?: string
  totalLabel?: string
  keyToLabel: Map<string, string>
}

function AreaChartTooltip({
  active,
  payload,
  label,
  formatValue,
  otherLabel = 'Other',
  totalLabel = 'Total:',
  keyToLabel,
}: AreaTooltipProps) {
  if (!active || !payload?.length) return null

  const fmt = formatValue ?? ((v: number) => v.toLocaleString())

  const items = payload
    .map((p) => ({
      key: sanitizeKey(p.dataKey),
      label: keyToLabel.get(sanitizeKey(p.dataKey)) ?? p.dataKey,
      value: typeof p.value === 'number' ? p.value : 0,
      color: p.color,
    }))
    .filter((p) => p.value > 0 || true)

  const otherItems = items.filter((p) => p.label === otherLabel)
  const modelItems = items.filter((p) => p.label !== otherLabel)
  modelItems.sort((a, b) => b.value - a.value)
  const sorted = [...modelItems, ...otherItems]

  const total = sorted.reduce((s, p) => s + p.value, 0)

  return (
    <div className='border-border/50 bg-background grid min-w-40 items-start gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'>
      {label && (
        <div className='text-muted-foreground mb-0.5 font-medium'>{label}</div>
      )}
      <div className='flex justify-between gap-4 font-medium'>
        <span>{totalLabel}</span>
        <span className='font-mono tabular-nums'>{fmt(total)}</span>
      </div>
      <div className='grid gap-1'>
        {sorted.map((p) => (
          <div key={p.key} className='flex w-full items-center gap-2'>
            <div
              className='h-2 w-2 shrink-0 rounded-sm'
              style={{ backgroundColor: p.color }}
            />
            <div className='flex flex-1 justify-between gap-4'>
              <span className='text-muted-foreground truncate max-w-36'>
                {p.label}
              </span>
              <span className='font-mono tabular-nums'>{fmt(p.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface DashboardAreaChartProps {
  data: AreaChartSeries
  formatValue?: (v: number) => string
  otherLabel?: string
  totalLabel?: string
  className?: string
}

export function DashboardAreaChart({
  data,
  formatValue,
  otherLabel,
  totalLabel,
  className,
}: DashboardAreaChartProps) {
  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {}
    data.series.forEach((name, i) => {
      const key = sanitizeKey(name)
      cfg[key] = {
        label: name,
        color: data.colors[i] ?? `hsl(var(--chart-${(i % 5) + 1}))`,
      }
    })
    return cfg
  }, [data.series, data.colors])

  const keyToLabel = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>()
    data.series.forEach((name) => m.set(sanitizeKey(name), name))
    return m
  }, [data.series])

  // Remap row keys to sanitized versions for recharts
  const rows = useMemo(
    () =>
      data.rows.map((row) => {
        const next: Record<string, string | number> = { Time: row.Time }
        for (const name of data.series) {
          const key = sanitizeKey(name)
          const raw = row[name]
          next[key] = typeof raw === 'number' ? raw : 0
        }
        return next
      }),
    [data.rows, data.series]
  )

  if (data.series.length === 0) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center text-xs'>
        No data
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className={className ?? 'h-full w-full'}>
      <AreaChart
        data={rows}
        margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray='3 3' className='stroke-border/40' />
        <XAxis
          dataKey='Time'
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval='preserveStartEnd'
        />
        <YAxis
          tickFormatter={formatValue}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip
          content={
            <AreaChartTooltip
              formatValue={formatValue}
              otherLabel={otherLabel}
              totalLabel={totalLabel}
              keyToLabel={keyToLabel}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value) => keyToLabel.get(value) ?? value}
        />
        {data.series.map((name) => {
          const key = sanitizeKey(name)
          return (
            <Area
              key={key}
              type='monotone'
              dataKey={key}
              stroke={`var(--color-${key})`}
              fill={`var(--color-${key})`}
              fillOpacity={0.08}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={true}
            />
          )
        })}
      </AreaChart>
    </ChartContainer>
  )
}
