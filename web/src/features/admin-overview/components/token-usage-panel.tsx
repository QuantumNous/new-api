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
import { Cpu } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { formatCompactNumber, formatInteger } from '@/lib/format'

import type { TokenSeriesEntry, TokenSeriesPoint } from '../types'

const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
] as const

export interface TokenUsagePanelProps {
  series: TokenSeriesEntry[]
  points: TokenSeriesPoint[]
  tokensToday: number
  requestsToday: number
  loading: boolean
}

export function TokenUsagePanel(props: TokenUsagePanelProps) {
  const { t } = useTranslation()
  const chartData = props.points.map((point) => ({
    label: point.label,
    ...point.values,
  }))
  const chartConfig: ChartConfig = Object.fromEntries(
    props.series.map((entry, index) => [
      entry.key,
      {
        label: entry.model === 'Other' ? t('Other') : entry.model,
        color: SERIES_COLORS[index] ?? SERIES_COLORS.at(-1),
      },
    ])
  )
  const hasData = props.points.some((point) => point.total > 0)

  let chartContent: ReactNode
  if (props.loading) {
    chartContent = <Skeleton className='h-full w-full' />
  } else if (hasData) {
    chartContent = (
      <ChartContainer
        config={chartConfig}
        className='aspect-auto h-full w-full'
      >
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray='3 3' />
          <XAxis
            dataKey='label'
            tickLine={false}
            axisLine={false}
            minTickGap={16}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(value) => formatCompactNumber(Number(value))}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {props.series.map((entry) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              stackId='tokens'
              fill={`var(--color-${entry.key})`}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ChartContainer>
    )
  } else {
    chartContent = (
      <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
        {t('No data available')}
      </div>
    )
  }

  return (
    <TitledCard
      title={t('Token usage today')}
      description={t('Token usage by model today')}
      icon={<Cpu />}
      iconTone='chart-4'
      action={
        <div className='flex items-center gap-4 text-end'>
          <div>
            <div className='text-muted-foreground text-[11px]'>
              {t('Tokens today')}
            </div>
            <div className='font-mono text-sm font-semibold tabular-nums'>
              {formatCompactNumber(props.tokensToday)}
            </div>
          </div>
          <div>
            <div className='text-muted-foreground text-[11px]'>
              {t('Requests')}
            </div>
            <div className='font-mono text-sm font-semibold tabular-nums'>
              {formatInteger(props.requestsToday)}
            </div>
          </div>
        </div>
      }
    >
      <div className='h-64 w-full'>{chartContent}</div>
    </TitledCard>
  )
}
