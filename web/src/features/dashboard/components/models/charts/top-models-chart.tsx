import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { getChartColor } from '@/lib/colors'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
} from '@/components/ui/chart'
import { PaginatedChartLegendContent } from '@/components/paginated-chart-legend'
import { PanelWrapper } from '@/features/dashboard/components/ui/panel-wrapper'
import { CHART_HEIGHTS } from '@/features/dashboard/constants'
import type { RankDataPoint } from '@/features/dashboard/types'

interface TopModelsChartProps {
  data: RankDataPoint[]
  loading?: boolean
}

export function TopModelsChart({ data, loading = false }: TopModelsChartProps) {
  const { t } = useTranslation()
  const isEmpty = !data || data.length === 0

  // Dynamic Y-axis width based on longest model name
  const yAxisWidth = useMemo(() => {
    if (!data?.length) return 100
    const maxLabelLength = Math.max(...data.map((d) => d.model.length))
    // ~7px per character + 16px padding, capped at 200px
    return Math.min(200, Math.max(100, maxLabelLength * 7 + 16))
  }, [data])

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <TrendingUp className='h-5 w-5' />
          {t('Top Models')}
        </span>
      }
      loading={loading}
      empty={isEmpty}
      emptyMessage={t('No model ranking data available')}
      height={CHART_HEIGHTS.default}
    >
      <ChartContainer
        config={{
          count: {
            label: 'Calls',
            color: getChartColor(0),
          },
        }}
        className={`${CHART_HEIGHTS.default} w-full`}
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
            width={yAxisWidth}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => [value.toString(), name]}
              />
            }
          />
          <ChartLegend content={<PaginatedChartLegendContent />} />
          <Bar
            dataKey='count'
            fill='var(--color-count)'
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ChartContainer>
    </PanelWrapper>
  )
}
