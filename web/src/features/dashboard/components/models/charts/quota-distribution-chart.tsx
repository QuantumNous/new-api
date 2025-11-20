import { useMemo } from 'react'
import { Coins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { getCurrencyDisplay } from '@/lib/currency'
import { formatCurrencyUSD } from '@/lib/format'
import { sanitizeCssVariableName } from '@/lib/utils'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart'
import { PaginatedChartLegendContent } from '@/components/paginated-chart-legend'
import { PanelWrapper } from '@/features/dashboard/components/ui/panel-wrapper'
import { calculateNiceCeiling } from '@/features/dashboard/lib/math'
import type { ChartDataPoint } from '@/features/dashboard/types'

interface QuotaDistributionChartProps {
  data: ChartDataPoint[]
  uniqueModels: string[]
  chartConfig: ChartConfig
  loading?: boolean
}

export function QuotaDistributionChart({
  data,
  uniqueModels,
  chartConfig,
  loading = false,
}: QuotaDistributionChartProps) {
  const { t } = useTranslation()
  const isEmpty = !data || data.length === 0
  const { meta } = getCurrencyDisplay()
  const usesExchangeRate = meta.kind === 'currency' || meta.kind === 'custom'
  const axisExchangeRate = usesExchangeRate ? meta.exchangeRate : 1

  // Calculate Y-axis domain for elegant ticks
  const yAxisProps = useMemo(() => {
    if (isEmpty) return { domain: [0, 0], ticks: [0] }

    const maxValueInUSD = Math.max(
      ...data.map((item) =>
        uniqueModels.reduce((acc, model) => acc + (Number(item[model]) || 0), 0)
      )
    )

    if (maxValueInUSD === 0) return { domain: [0, 0], ticks: [0] }

    const maxValueInDisplayCurrency = maxValueInUSD * axisExchangeRate
    const tickCount = 5

    const niceMax = calculateNiceCeiling(maxValueInDisplayCurrency, tickCount)

    if (niceMax === 0) {
      return { domain: [0, 0], ticks: [0] }
    }

    const increment = niceMax / (tickCount - 1)

    const displayTicks = Array.from({ length: tickCount }, (_, i) => {
      return increment * i
    })

    const canScale = usesExchangeRate && axisExchangeRate !== 0
    const usdTicks = canScale
      ? displayTicks.map((t) => t / axisExchangeRate)
      : displayTicks

    const domainMax = canScale ? niceMax / axisExchangeRate : niceMax

    return {
      domain: [0, domainMax],
      ticks: usdTicks,
    }
  }, [data, uniqueModels, isEmpty, axisExchangeRate, usesExchangeRate])

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <Coins className='h-5 w-5' />
          {t('Quota Distribution')}
        </span>
      }
      loading={loading}
      empty={isEmpty}
      emptyMessage={t('No quota data available')}
      height='h-[30rem] sm:h-96'
    >
      <ChartContainer config={chartConfig} className='h-[30rem] w-full sm:h-96'>
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 0, right: 0, bottom: 40, left: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey='time'
            tickLine={false}
            tickMargin={10}
            axisLine={false}
          />
          <YAxis
            {...yAxisProps}
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
          <ChartLegend
            content={<PaginatedChartLegendContent className='pt-2 sm:pt-3' />}
          />
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
    </PanelWrapper>
  )
}
