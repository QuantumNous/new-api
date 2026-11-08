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
import { Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/shared/components/ui/chart'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { TitledCard } from '@/shared/components/ui/titled-card'
import { formatInteger, formatPercent } from '@/shared/lib/format'

import type { HourlyActivityPoint } from '../types'

export interface ActiveUsersPanelProps {
  activeUsers: number
  registeredUsers: number
  points: HourlyActivityPoint[]
  loading: boolean
}

export function ActiveUsersPanel(props: ActiveUsersPanelProps) {
  const { t } = useTranslation()
  const chartConfig = {
    activeUsers: {
      label: t('Active users per hour'),
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig
  const activeRate =
    props.registeredUsers > 0
      ? (props.activeUsers / props.registeredUsers) * 100
      : 0

  return (
    <TitledCard
      title={t('Active users (24h)')}
      description={t('Active users in the last 24 hours')}
      icon={<Users />}
      iconTone='info'
    >
      <div className='flex flex-col gap-4'>
        <div className='grid grid-cols-2 gap-2'>
          <div className='bg-muted/40 rounded-xl px-3 py-2.5'>
            <div className='text-muted-foreground text-[11px] font-medium'>
              {t('Registered users')}
            </div>
            <div className='mt-1 font-mono text-lg font-semibold tabular-nums'>
              {formatInteger(props.registeredUsers)}
            </div>
          </div>
          <div className='bg-muted/40 rounded-xl px-3 py-2.5'>
            <div className='text-muted-foreground text-[11px] font-medium'>
              {t('Active rate')}
            </div>
            <div className='text-success mt-1 font-mono text-lg font-semibold tabular-nums'>
              {formatPercent(activeRate)}
            </div>
          </div>
        </div>

        <div className='h-44 w-full'>
          {props.loading ? (
            <Skeleton className='h-full w-full' />
          ) : (
            <ChartContainer
              config={chartConfig}
              className='aspect-auto h-full w-full'
            >
              <BarChart
                data={props.points}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id='activeUsersGradient'
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop
                      offset='5%'
                      stopColor='var(--color-activeUsers)'
                      stopOpacity={0.95}
                    />
                    <stop
                      offset='95%'
                      stopColor='var(--color-activeUsers)'
                      stopOpacity={0.35}
                    />
                  </linearGradient>
                </defs>
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
                  width={32}
                  allowDecimals={false}
                  tickFormatter={(value) => formatInteger(Number(value))}
                />
                <ChartTooltip
                  cursor={{ fill: 'var(--muted)' }}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatInteger(Number(value))}
                    />
                  }
                />
                <Bar
                  dataKey='activeUsers'
                  fill='url(#activeUsersGradient)'
                  radius={[3, 3, 0, 0]}
                  maxBarSize={40}
                  animationDuration={450}
                  animationEasing='ease-out'
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </div>
    </TitledCard>
  )
}
