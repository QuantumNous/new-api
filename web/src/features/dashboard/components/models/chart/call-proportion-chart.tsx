import { PieChart as PieChartIcon } from 'lucide-react'
import { PieChart, Pie, Cell } from 'recharts'
import { formatCompactNumber } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { PieDataPoint } from '@/features/dashboard/types'

interface CallProportionChartProps {
  data: PieDataPoint[]
  chartConfig: ChartConfig
}

export function CallProportionChart({
  data,
  chartConfig,
}: CallProportionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <PieChartIcon className='h-5 w-5' />
          Call Proportion
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className='h-96 w-full'>
          <PieChart>
            <Pie
              data={data}
              cx='50%'
              cy='50%'
              labelLine={false}
              label={({ name, percent }) =>
                `${name} ${((percent || 0) * 100).toFixed(1)}%`
              }
              outerRadius={120}
              innerRadius={60}
              dataKey='value'
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCompactNumber(Number(value))}
                  nameKey='name'
                />
              }
            />
            <ChartLegend content={<ChartLegendContent nameKey='name' />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
