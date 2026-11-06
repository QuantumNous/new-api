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
import { CircleDollarSign } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  formatCompactNumber,
  formatQuota,
  quotaUnitsToDollars,
} from '@/lib/format'

import type { DailyRevenuePoint } from '../types'

export interface RevenuePanelProps {
  points: DailyRevenuePoint[]
  revenueToday: number
  revenueMonth: number
  revenueAllTime: number | null
  loading: boolean
}

export function RevenuePanel(props: RevenuePanelProps) {
  const { t } = useTranslation()
  const chartConfig = {
    quota: {
      label: t('Revenue'),
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig
  const hasData = props.points.some((point) => point.quota > 0)

  let chartContent: ReactNode
  if (props.loading) {
    chartContent = <Skeleton className='h-full w-full' />
  } else if (hasData) {
    chartContent = (
      <ChartContainer
        config={chartConfig}
        className='aspect-auto h-full w-full'
      >
        <AreaChart
          data={props.points}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray='3 3' />
          <XAxis
            dataKey='label'
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(value) =>
              formatCompactNumber(quotaUnitsToDollars(Number(value)))
            }
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatter={(value) => formatQuota(Number(value))}
              />
            }
          />
          <Area
            dataKey='quota'
            type='monotone'
            stroke='var(--color-quota)'
            fill='var(--color-quota)'
            fillOpacity={0.16}
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    )
  } else {
    chartContent = <EmptyChart />
  }

  return (
    <TitledCard
      title={t('Sales & Revenue')}
      description={t('Revenue over the last 30 days')}
      icon={<CircleDollarSign />}
      iconTone='success'
      action={
        <div className='text-end'>
          <div className='text-muted-foreground text-[11px]'>
            {t('Revenue this month')}
          </div>
          <div className='font-mono text-sm font-semibold tabular-nums'>
            {formatQuota(props.revenueMonth)}
          </div>
        </div>
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='h-56 w-full'>{chartContent}</div>

        <dl className='grid grid-cols-3 gap-2'>
          <SummaryCell
            label={t('Today')}
            value={formatQuota(props.revenueToday)}
          />
          <SummaryCell
            label={t('This month')}
            value={formatQuota(props.revenueMonth)}
          />
          <SummaryCell
            label={t('All time')}
            value={
              props.revenueAllTime == null
                ? '-'
                : formatQuota(props.revenueAllTime)
            }
          />
        </dl>

        <p className='text-muted-foreground text-[11px]'>
          {t('Usage data may lag by a few minutes')}
        </p>
      </div>
    </TitledCard>
  )
}

function SummaryCell(props: { label: string; value: string }) {
  return (
    <div className='bg-muted/40 rounded-lg px-2.5 py-2'>
      <dt className='text-muted-foreground truncate text-[11px] font-medium'>
        {props.label}
      </dt>
      <dd className='mt-1 truncate font-mono text-xs font-semibold tabular-nums'>
        {props.value}
      </dd>
    </div>
  )
}

function EmptyChart() {
  const { t } = useTranslation()
  return (
    <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
      {t('No data available')}
    </div>
  )
}
