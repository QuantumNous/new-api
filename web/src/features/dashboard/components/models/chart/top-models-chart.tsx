import { TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { getChartColor } from '@/lib/colors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import type { RankDataPoint } from '@/features/dashboard/types'

interface TopModelsChartProps {
  data: RankDataPoint[]
}

export function TopModelsChart({ data }: TopModelsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <TrendingUp className='h-5 w-5' />
          Top Models
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            count: {
              label: 'Calls',
              color: getChartColor(0),
            },
          }}
          className='h-96 w-full'
        >
          <BarChart accessibilityLayer data={data} layout='vertical'>
            <CartesianGrid horizontal={false} />
            <XAxis
              type='number'
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              allowDecimals={false}
              domain={[0, 'dataMax']}
              tickFormatter={(value) => value.toString()}
            />
            <YAxis
              type='category'
              dataKey='model'
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              width={150}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [value.toString(), name]}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey='count'
              fill='var(--color-count)'
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
