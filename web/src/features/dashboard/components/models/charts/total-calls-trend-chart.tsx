import { TrendingUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { getChartColor } from '@/lib/colors'
import { formatCurrencyUSD, formatCompactNumber } from '@/lib/format'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { PanelWrapper } from '@/features/dashboard/components/ui/panel-wrapper'
import type { TotalTrendDataPoint } from '@/features/dashboard/types'

interface TotalCallsTrendChartProps {
  data: TotalTrendDataPoint[]
  loading?: boolean
}

export function TotalCallsTrendChart({
  data,
  loading = false,
}: TotalCallsTrendChartProps) {
  const isEmpty = !data || data.length === 0

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <TrendingUp className='h-5 w-5' />
          Total Calls Trend
        </span>
      }
      loading={loading}
      empty={isEmpty}
      emptyMessage='No total calls data available'
      height='h-96'
    >
      <ChartContainer
        config={{
          calls: {
            label: 'Total Calls',
            color: getChartColor(0),
          },
          quota: {
            label: 'Total Quota',
            color: getChartColor(1),
          },
        }}
        className='h-96 w-full'
      >
        <AreaChart accessibilityLayer data={data}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey='time'
            tickLine={false}
            tickMargin={10}
            axisLine={false}
          />
          <YAxis
            yAxisId='left'
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => formatCompactNumber(Number(value))}
          />
          <YAxis
            yAxisId='right'
            orientation='right'
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => formatCurrencyUSD(Number(value))}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => {
                  if (name === 'Total Quota') {
                    return [formatCurrencyUSD(Number(value)), name]
                  }
                  return [formatCompactNumber(Number(value)), name]
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Area
            yAxisId='left'
            type='monotone'
            dataKey='calls'
            name='Total Calls'
            stroke='var(--color-calls)'
            fill='var(--color-calls)'
            strokeWidth={2}
            fillOpacity={0.4}
          />
          <Area
            yAxisId='right'
            type='monotone'
            dataKey='quota'
            name='Total Quota'
            stroke='var(--color-quota)'
            fill='var(--color-quota)'
            strokeWidth={2}
            fillOpacity={0.4}
          />
        </AreaChart>
      </ChartContainer>
    </PanelWrapper>
  )
}
