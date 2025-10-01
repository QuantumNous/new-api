import { TrendingUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { getChartColor } from '@/lib/colors'
import { formatCurrencyUSD, formatCompactNumber } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import type { TotalTrendDataPoint } from '@/features/dashboard/types'

interface TotalCallsTrendChartProps {
  data: TotalTrendDataPoint[]
}

export function TotalCallsTrendChart({ data }: TotalCallsTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <TrendingUp className='h-5 w-5' />
          Total Calls Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
