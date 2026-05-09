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
import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import type { PieChartSlice } from '@/features/dashboard/types'

function sanitizeKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

interface DashboardPieChartProps {
  data: PieChartSlice[]
  colors: string[]
  formatValue?: (v: number) => string
  innerRadius?: number | string
  outerRadius?: number | string
  className?: string
}

export function DashboardPieChart({
  data,
  colors,
  formatValue,
  innerRadius = '50%',
  outerRadius = '80%',
  className,
}: DashboardPieChartProps) {
  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {}
    data.forEach((slice, i) => {
      const key = sanitizeKey(slice.name)
      cfg[key] = {
        label: slice.name,
        color: colors[i] ?? `hsl(var(--chart-${(i % 5) + 1}))`,
      }
    })
    return cfg
  }, [data, colors])

  const cells = useMemo(
    () =>
      data.map((slice, i) => ({
        key: sanitizeKey(slice.name),
        color: colors[i] ?? `hsl(var(--chart-${(i % 5) + 1}))`,
        ...slice,
      })),
    [data, colors]
  )

  if (data.length === 0) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center text-xs'>
        No data
      </div>
    )
  }

  const fmt = formatValue ?? ((v: number) => v.toLocaleString())

  return (
    <ChartContainer config={chartConfig} className={className ?? 'h-full w-full'}>
      <PieChart>
        <Pie
          data={cells}
          dataKey='value'
          nameKey='name'
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          isAnimationActive={false}
        >
          {cells.map((c) => (
            <Cell key={c.key} fill={c.color} stroke='transparent' />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const item = payload[0]
            return (
              <div className='border-border/50 bg-background grid min-w-32 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'>
                <div className='flex items-center gap-2'>
                  <div
                    className='h-2 w-2 shrink-0 rounded-sm'
                    style={{ backgroundColor: item.payload?.color }}
                  />
                  <span className='text-muted-foreground max-w-40 truncate'>
                    {item.name}
                  </span>
                </div>
                <span className='font-mono font-medium tabular-nums'>
                  {fmt(Number(item.value) || 0)}
                </span>
              </div>
            )
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value) => value}
        />
      </PieChart>
    </ChartContainer>
  )
}
