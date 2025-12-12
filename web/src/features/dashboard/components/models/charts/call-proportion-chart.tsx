import { useCallback, useMemo } from 'react'
import { PieChart as PieChartIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PieChart, Pie, Cell } from 'recharts'
import { formatCompactNumber } from '@/lib/format'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  type ChartConfig,
} from '@/components/ui/chart'
import { PaginatedChartLegendContent } from '@/components/paginated-chart-legend'
import { PanelWrapper } from '@/features/dashboard/components/ui/panel-wrapper'
import { CHART_HEIGHTS } from '@/features/dashboard/constants'
import type { PieDataPoint } from '@/features/dashboard/types'

const MIN_VISIBLE_PERCENT = 0.05
const LABEL_OFFSET = 16
const RADIAN = Math.PI / 180

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
  const { t } = useTranslation()
  const isEmpty = !data || data.length === 0
  const totalValue = useMemo(
    () => data.reduce((sum, point) => sum + Number(point.value ?? 0), 0),
    [data]
  )

  // Responsive label count: fewer labels on mobile to reduce clutter
  const maxVisibleLabels = useMemo(() => {
    if (typeof window === 'undefined') return 6
    return window.innerWidth < 640 ? 4 : 6
  }, [])

  const labelWhitelist = useMemo<Set<string>>(() => {
    if (!data?.length) {
      return new Set<string>()
    }

    if (data.length <= maxVisibleLabels || totalValue === 0) {
      return new Set(data.map((point) => point.name))
    }

    const sortedByValue = [...data].sort((a, b) => b.value - a.value)
    const selectedNames: string[] = []
    const addName = (name: string) => {
      if (
        selectedNames.length < maxVisibleLabels &&
        !selectedNames.includes(name)
      ) {
        selectedNames.push(name)
      }
    }

    sortedByValue.forEach((point) => {
      const percent = point.value / totalValue
      if (percent >= MIN_VISIBLE_PERCENT) {
        addName(point.name)
      }
    })

    sortedByValue.forEach((point) => addName(point.name))

    return new Set(selectedNames)
  }, [data, totalValue, maxVisibleLabels])

  const shouldShowLabelLines = useMemo(
    () => labelWhitelist.size > 0 && data.length > 1 && totalValue > 0,
    [data.length, labelWhitelist, totalValue]
  )

  const renderSliceLabel = useCallback(
    ({
      cx,
      cy,
      midAngle = 0,
      outerRadius = 0,
      name,
      percent,
      value,
    }: {
      cx?: string | number
      cy?: string | number
      midAngle?: number
      outerRadius?: number
      name?: string
      percent?: number
      value?: number
    }) => {
      if (!name || !labelWhitelist.has(name) || !totalValue) {
        return null
      }

      const slicePercent =
        typeof percent === 'number'
          ? percent
          : (Number(value ?? 0) || 0) / totalValue

      if (!slicePercent || slicePercent <= 0) {
        return null
      }

      const centerX =
        typeof cx === 'number'
          ? cx
          : typeof cx === 'string'
            ? parseFloat(cx) || 0
            : 0
      const centerY =
        typeof cy === 'number'
          ? cy
          : typeof cy === 'string'
            ? parseFloat(cy) || 0
            : 0
      const radius = outerRadius + LABEL_OFFSET
      const angle = -midAngle * RADIAN || 0
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)

      return (
        <text
          x={x}
          y={y}
          fill='var(--muted-foreground)'
          textAnchor={x > centerX ? 'start' : 'end'}
          dominantBaseline='central'
          className='text-xs font-medium'
        >
          {`${name} ${(slicePercent * 100).toFixed(1)}%`}
        </text>
      )
    },
    [labelWhitelist, totalValue]
  )

  const renderSliceLabelLine = useCallback(
    (props: {
      payload?: { name?: string }
      points?: Array<{ x: number; y: number }>
      stroke?: string
    }): React.ReactElement | null => {
      const name = props?.payload?.name
      if (!name || !labelWhitelist.has(name)) {
        return null
      }

      const points = props?.points
      if (!points || points.length === 0) {
        return null
      }

      const path = points
        .map(
          (point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`
        )
        .join(' ')

      return (
        <path
          d={path}
          stroke={props?.stroke || 'var(--border)'}
          fill='none'
          strokeWidth={1}
          className='opacity-70'
        />
      )
    },
    [labelWhitelist]
  )

  const formatTooltipValue = useCallback(
    (rawValue: number, _name: string, item: any) => {
      const numericValue = Number(rawValue) || 0
      const payloadValue =
        Number(item?.payload?.value ?? numericValue) || numericValue
      const slicePercent =
        typeof item?.payload?.percent === 'number'
          ? item.payload.percent
          : totalValue
            ? payloadValue / totalValue
            : 0

      const percentLabel =
        slicePercent > 0 ? ` (${(slicePercent * 100).toFixed(1)}%)` : ''

      return `${formatCompactNumber(numericValue)}${percentLabel}`
    },
    [totalValue]
  )

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <PieChartIcon className='h-5 w-5' />
          {t('Call Proportion')}
        </span>
      }
      loading={loading}
      empty={isEmpty}
      emptyMessage={t('No call data available')}
      height={CHART_HEIGHTS.withLabels}
    >
      <ChartContainer
        config={chartConfig}
        className={`${CHART_HEIGHTS.withLabels} w-full`}
      >
        <PieChart margin={{ top: 32, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={data}
            cx='50%'
            cy='42%'
            labelLine={
              shouldShowLabelLines ? (renderSliceLabelLine as any) : undefined
            }
            label={renderSliceLabel}
            outerRadius={105}
            innerRadius={52}
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
                formatter={formatTooltipValue}
                nameKey='name'
              />
            }
          />
          <ChartLegend
            content={<PaginatedChartLegendContent className='pt-6 sm:pt-4' />}
            verticalAlign='bottom'
          />
        </PieChart>
      </ChartContainer>
    </PanelWrapper>
  )
}
