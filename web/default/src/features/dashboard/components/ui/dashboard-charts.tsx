/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  getDashboardChartColors,
  USER_CHART_COLORS,
} from '@/features/dashboard/lib/chart-palette'
import type {
  DashboardPieChart,
  DashboardRankChart,
  DashboardSeriesChart,
} from '@/features/dashboard/types'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

function seriesColor(index: number, colors?: readonly string[]): string {
  if (colors?.length) return colors[index % colors.length]
  return (
    getDashboardChartColors(Math.max(index + 1, 1))[index] ?? 'var(--chart-1)'
  )
}

function buildSeriesConfig(
  seriesKeys: string[],
  colors?: readonly string[]
): ChartConfig {
  const config: ChartConfig = {}
  seriesKeys.forEach((key, index) => {
    config[key] = {
      label: key,
      color: seriesColor(index, colors),
    }
  })
  return config
}

/** Values for `valueKind: 'quota'` are already in currency display units. */
function formatSeriesValue(
  value: number,
  valueKind: 'quota' | 'count'
): string {
  if (valueKind === 'count') return formatNumber(value)
  return formatNumber(value)
}

export function DashboardSeriesChartView(props: {
  chart: DashboardSeriesChart
  variant: 'area' | 'bar'
  className?: string
  colors?: readonly string[]
  hideLegend?: boolean
}) {
  const { t } = useTranslation()
  const config = useMemo(
    () => buildSeriesConfig(props.chart.seriesKeys, props.colors),
    [props.chart.seriesKeys, props.colors]
  )
  const stacked = Boolean(props.chart.stacked)
  const gradientId = useId().replaceAll(':', '')

  if (props.chart.rows.length === 0 || props.chart.seriesKeys.length === 0) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex h-full items-center justify-center text-sm',
          props.className
        )}
      >
        {t('No data available')}
      </div>
    )
  }

  const axes = (
    <>
      <CartesianGrid vertical={false} strokeDasharray='3 3' />
      <XAxis
        dataKey={props.chart.xKey}
        tickLine={false}
        axisLine={false}
        minTickGap={24}
        tickMargin={8}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={52}
        tickFormatter={(value) =>
          formatSeriesValue(Number(value) || 0, props.chart.valueKind)
        }
      />
      <ChartTooltip
        content={
          <ChartTooltipContent
            formatter={(value) => (
              <span className='font-mono tabular-nums'>
                {formatSeriesValue(Number(value) || 0, props.chart.valueKind)}
              </span>
            )}
          />
        }
      />
      {!props.hideLegend && <ChartLegend content={<ChartLegendContent />} />}
    </>
  )

  return (
    <ChartContainer
      config={config}
      className={cn('aspect-auto h-full w-full', props.className)}
    >
      {props.variant === 'area' ? (
        <AreaChart data={props.chart.rows} margin={{ left: 4, right: 8 }}>
          <defs>
            {props.chart.seriesKeys.map((key, index) => {
              const color = seriesColor(index, props.colors)
              return (
                <linearGradient
                  key={key}
                  id={`${gradientId}-${index}`}
                  x1='0'
                  y1='0'
                  x2='0'
                  y2='1'
                >
                  <stop
                    offset='0%'
                    stopColor={color}
                    stopOpacity={stacked ? 0.7 : 0.35}
                  />
                  <stop offset='100%' stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              )
            })}
          </defs>
          {axes}
          {props.chart.seriesKeys.map((key, index) => {
            const color = seriesColor(index, props.colors)
            return (
              <Area
                key={key}
                type='monotone'
                dataKey={key}
                stroke={color}
                fill={`url(#${gradientId}-${index})`}
                strokeWidth={2}
                stackId={stacked ? 'stack' : undefined}
                dot={false}
                isAnimationActive
              />
            )
          })}
        </AreaChart>
      ) : (
        <BarChart data={props.chart.rows} margin={{ left: 4, right: 8 }}>
          {axes}
          {props.chart.seriesKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              fill={seriesColor(index, props.colors)}
              radius={stacked ? 0 : 3}
              stackId={stacked ? 'stack' : undefined}
              isAnimationActive
            />
          ))}
        </BarChart>
      )}
    </ChartContainer>
  )
}

export function DashboardPieChartView(props: {
  chart: DashboardPieChart
  className?: string
}) {
  const { t } = useTranslation()
  const config = useMemo(() => {
    const entries: ChartConfig = {}
    props.chart.rows.forEach((row, index) => {
      entries[`slice-${index}`] = { label: row.name, color: row.fill }
    })
    return entries
  }, [props.chart.rows])

  if (props.chart.rows.length === 0) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex h-full items-center justify-center text-sm',
          props.className
        )}
      >
        {t('No data available')}
      </div>
    )
  }

  const pieData = props.chart.rows.map((row, index) => ({
    ...row,
    key: `slice-${index}`,
  }))

  return (
    <ChartContainer
      config={config}
      className={cn('aspect-auto h-full w-full', props.className)}
    >
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey='name'
              formatter={(value) => (
                <span className='font-mono tabular-nums'>
                  {formatNumber(Number(value) || 0)}
                </span>
              )}
            />
          }
        />
        <Pie
          data={pieData}
          dataKey='value'
          nameKey='name'
          innerRadius='48%'
          outerRadius='78%'
          strokeWidth={2}
          paddingAngle={1.5}
          isAnimationActive
        >
          {pieData.map((row) => (
            <Cell key={row.key} fill={row.fill} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey='name' />} />
      </PieChart>
    </ChartContainer>
  )
}

export function DashboardRankChartView(props: {
  chart: DashboardRankChart
  className?: string
}) {
  const { t } = useTranslation()
  const config = useMemo(() => {
    const entries: ChartConfig = { value: { label: t('Value') } }
    props.chart.rows.forEach((row, index) => {
      entries[`rank-${index}`] = { label: row.name, color: row.fill }
    })
    return entries
  }, [props.chart.rows, t])

  if (props.chart.rows.length === 0) {
    return (
      <div
        className={cn(
          'text-muted-foreground flex h-full items-center justify-center text-sm',
          props.className
        )}
      >
        {t('No data available')}
      </div>
    )
  }

  const isVertical = props.chart.layout === 'vertical'

  return (
    <ChartContainer
      config={config}
      className={cn('aspect-auto h-full w-full', props.className)}
    >
      <BarChart
        data={props.chart.rows}
        layout={isVertical ? 'vertical' : 'horizontal'}
        margin={{ left: isVertical ? 8 : 4, right: 16, top: 8, bottom: 8 }}
      >
        <CartesianGrid
          vertical={!isVertical}
          horizontal={isVertical}
          strokeDasharray='3 3'
        />
        {isVertical ? (
          <>
            <YAxis
              dataKey='name'
              type='category'
              tickLine={false}
              axisLine={false}
              width={96}
            />
            <XAxis type='number' hide />
          </>
        ) : (
          <>
            <XAxis
              dataKey='name'
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-28}
              textAnchor='end'
              height={64}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(value) =>
                formatSeriesValue(Number(value) || 0, props.chart.valueKind)
              }
            />
          </>
        )}
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className='font-mono tabular-nums'>
                  {formatSeriesValue(Number(value) || 0, props.chart.valueKind)}
                </span>
              )}
            />
          }
        />
        <Bar dataKey='value' radius={3} isAnimationActive>
          {props.chart.rows.map((row) => (
            <Cell key={row.name} fill={row.fill} />
          ))}
          {isVertical && (
            <LabelList
              dataKey='value'
              position='right'
              className='fill-foreground text-[10px] tabular-nums'
              formatter={(value) =>
                formatSeriesValue(Number(value) || 0, props.chart.valueKind)
              }
            />
          )}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export function DashboardMiniArea(props: {
  data: Array<{ label: string; value: number }>
  color?: string
  className?: string
}) {
  const color = props.color ?? 'var(--chart-1)'
  const gradientId = useId().replaceAll(':', '')
  const config = useMemo(
    () =>
      ({
        value: { label: 'value', color },
      }) satisfies ChartConfig,
    [color]
  )

  if (props.data.length === 0) {
    return <div className={cn('h-16', props.className)} aria-hidden='true' />
  }

  return (
    <ChartContainer
      config={config}
      className={cn('aspect-auto h-16 w-full', props.className)}
      initialDimension={{ width: 240, height: 64 }}
    >
      <AreaChart
        data={props.data}
        margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor={color} stopOpacity={0.35} />
            <stop offset='100%' stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type='monotone'
          dataKey='value'
          stroke={color}
          fill={`url(#${gradientId})`}
          strokeWidth={2}
          dot={false}
          isAnimationActive
        />
      </AreaChart>
    </ChartContainer>
  )
}

export { USER_CHART_COLORS }
