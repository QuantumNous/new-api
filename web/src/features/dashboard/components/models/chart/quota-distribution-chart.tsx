import { Coins } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { formatCurrencyUSD } from '@/lib/format'
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

interface QuotaDistributionChartProps {
  data: ChartDataPoint[]
  uniqueModels: string[]
  chartConfig: ChartConfig
}

export function QuotaDistributionChart({
  data,
  uniqueModels,
  chartConfig,
}: QuotaDistributionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Coins className='h-5 w-5' />
          Quota Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className='h-96 w-full'>
          <BarChart accessibilityLayer data={data}>
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
              tickFormatter={(value) => formatCurrencyUSD(Number(value))}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    formatCurrencyUSD(Number(value)),
                    name,
                  ]}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {uniqueModels.map((model, index) => (
              <Bar
                key={model}
                dataKey={model}
                stackId='a'
                fill={`var(--color-${sanitizeCssVariableName(model)})`}
                radius={index === uniqueModels.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
