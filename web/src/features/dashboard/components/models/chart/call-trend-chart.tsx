import { Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { formatCompactNumber } from '@/lib/format'
import { sanitizeCssVariableName } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { ChartDataPoint } from '@/features/dashboard/types'

interface CallTrendChartProps {
  data: ChartDataPoint[]
  uniqueModels: string[]
  chartConfig: ChartConfig
}

export function CallTrendChart({
  data,
  uniqueModels,
  chartConfig,
}: CallTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Activity className='h-5 w-5' />
          Call Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className='h-96 w-full'>
          <AreaChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='time'
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => formatCompactNumber(Number(value))}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    formatCompactNumber(Number(value)),
                    name,
                  ]}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {uniqueModels.map((model) => (
              <Area
                key={model}
                type='monotone'
                dataKey={model}
                name={model}
                stroke={`var(--color-${sanitizeCssVariableName(model)})`}
                fill={`var(--color-${sanitizeCssVariableName(model)})`}
                strokeWidth={2}
                fillOpacity={0.2}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
