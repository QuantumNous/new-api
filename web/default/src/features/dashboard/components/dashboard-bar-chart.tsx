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
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import type { RankBarRow } from '@/features/dashboard/types'

interface DashboardBarChartProps {
  data: RankBarRow[]
  color?: string
  formatValue?: (v: number) => string
  formatLabel?: (v: number) => string
  layout?: 'horizontal' | 'vertical'
  showLabels?: boolean
  className?: string
}

const CHART_CONFIG: ChartConfig = { value: { label: 'Value', color: 'hsl(var(--chart-1))' } }

export function DashboardBarChart({
  data,
  color = 'hsl(var(--chart-1))',
  formatValue,
  layout = 'horizontal',
  className,
}: DashboardBarChartProps) {
  const fmt = formatValue ?? ((v: number) => v.toLocaleString())

  if (data.length === 0) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center text-xs'>
        No data
      </div>
    )
  }

  if (layout === 'horizontal') {
    // horizontal layout: names on Y axis, values on X axis
    return (
      <ChartContainer config={CHART_CONFIG} className={className ?? 'h-full w-full'}>
        <BarChart
          data={data}
          layout='vertical'
          margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray='3 3' className='stroke-border/40' horizontal={false} />
          <XAxis
            type='number'
            tickFormatter={fmt}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type='category'
            dataKey='name'
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className='border-border/50 bg-background grid min-w-32 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'>
                  <div className='text-muted-foreground font-medium'>{label}</div>
                  <span className='font-mono font-medium tabular-nums'>
                    {fmt(Number(payload[0]?.value) || 0)}
                  </span>
                </div>
              )
            }}
          />
          <Bar dataKey='value' radius={4} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    )
  }

  // vertical layout: names on X axis, values on Y axis
  return (
    <ChartContainer config={CHART_CONFIG} className={className ?? 'h-full w-full'}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray='3 3' className='stroke-border/40' vertical={false} />
        <XAxis
          dataKey='name'
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-30}
          textAnchor='end'
          height={50}
        />
        <YAxis
          tickFormatter={fmt}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className='border-border/50 bg-background grid min-w-32 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'>
                <div className='text-muted-foreground font-medium'>{label}</div>
                <span className='font-mono font-medium tabular-nums'>
                  {fmt(Number(payload[0]?.value) || 0)}
                </span>
              </div>
            )
          }}
        />
        <Bar dataKey='value' radius={4} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
