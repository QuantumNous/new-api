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
import { type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { OVERVIEW_KPI_TILE_CLASS } from './overview-reference-styles'
import { OverviewSparkline } from './overview-sparkline'

export interface OverviewTrendProps {
  pct: number | null
  direction: 'up' | 'down' | 'flat'
  lowerIsBetter?: boolean
}

interface OverviewKpiCardProps {
  title: string
  value: string
  icon: LucideIcon
  iconBg?: string
  iconColor?: string
  sparkline?: number[]
  sparklineColor?: string
  trend?: OverviewTrendProps
  hint?: string
  loading?: boolean
  valueMuted?: boolean
  trailing?: React.ReactNode
}

function TrendLine(props: {
  trend: OverviewTrendProps
  hint?: string
}) {
  const { t } = useTranslation()
  const { trend, hint } = props

  if (trend.pct === null) {
    return hint ? (
      <p className='truncate text-[11px] text-[#6B7280]'>{hint}</p>
    ) : null
  }

  const isGood =
    trend.direction === 'flat' ||
    (trend.lowerIsBetter
      ? trend.direction === 'down'
      : trend.direction === 'up')
  const isBad =
    trend.direction !== 'flat' &&
    (trend.lowerIsBetter
      ? trend.direction === 'up'
      : trend.direction === 'down')

  const arrow =
    trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '—'

  return (
    <p
      className={cn(
        'truncate text-[11px]',
        isGood && 'text-[#16A34A]',
        isBad && 'text-[#DC2626]',
        trend.direction === 'flat' && 'text-[#9CA3AF]'
      )}
    >
      {t('Dashboard KPI vs yesterday', {
        pct: trend.pct.toFixed(1),
        arrow,
      })}
    </p>
  )
}

export function OverviewKpiCard(props: OverviewKpiCardProps) {
  const Icon = props.icon
  const stroke = props.sparklineColor ?? '#3B82F6'

  return (
    <article className={OVERVIEW_KPI_TILE_CLASS}>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-1.5'>
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-md',
              props.iconBg ?? 'bg-[#EFF6FF]'
            )}
          >
            <Icon
              className={cn('size-3.5', props.iconColor ?? 'text-[#2563EB]')}
              aria-hidden='true'
            />
          </span>
          <span className='truncate text-[12px] text-[#6B7280]'>{props.title}</span>
        </div>
        {props.trailing ??
          (!props.loading ? (
            <OverviewSparkline
              values={props.sparkline}
              stroke={stroke}
              fill={stroke}
              width={80}
              height={26}
            />
          ) : (
            <Skeleton className='h-6 w-20' />
          ))}
      </div>

      <div className='mt-auto pt-1'>
        {props.loading ? (
          <Skeleton className='h-6 w-24' />
        ) : (
          <p
            className={cn(
              'font-[DIN,sans-serif] font-bold leading-none tracking-tight',
              props.valueMuted
                ? 'text-[15px] font-medium text-[#9CA3AF]'
                : 'text-[20px] text-[#111827]'
            )}
          >
            {props.value}
          </p>
        )}
        <div className='mt-1'>
          {props.trend ? (
            <TrendLine trend={props.trend} hint={props.hint} />
          ) : props.hint ? (
            <p className='truncate text-[11px] text-[#6B7280]'>{props.hint}</p>
          ) : null}
        </div>
      </div>
    </article>
  )
}
