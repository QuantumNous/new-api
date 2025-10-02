import { PieChart as PieChartIcon } from 'lucide-react'
import { PieChart, Pie, Cell } from 'recharts'
import { formatCompactNumber } from '@/lib/format'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PanelWrapper } from '@/features/dashboard/components/ui/panel-wrapper'
import type { PieDataPoint } from '@/features/dashboard/types'

interface CallProportionChartProps {
  data: PieDataPoint[]
  chartConfig: ChartConfig
  loading?: boolean
}

export function CallProportionChart({
  data,
  chartConfig,
  loading = false,
}: CallProportionChartProps) {
  const isEmpty = !data || data.length === 0

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <PieChartIcon className='h-5 w-5' />
          Call Proportion
        </span>
      }
      loading={loading}
      empty={isEmpty}
      emptyMessage='No call data available'
      height='h-96'
    >
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
    </PanelWrapper>
  )
}
