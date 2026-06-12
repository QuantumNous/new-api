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
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type OperationalTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

interface OperationalMetricCardProps {
  label: string
  value: ReactNode
  unit?: string
  description?: ReactNode
  icon?: ReactNode
  tone?: OperationalTone
  action?: ReactNode
  sparkline?: number[]
  sparklineVariant?: 'bars' | 'line'
  className?: string
}

const toneClassName: Record<OperationalTone, string> = {
  neutral: 'operator-rail-neutral',
  success: 'operator-rail-active',
  warning: 'operator-rail-warning',
  danger: 'operator-rail-danger',
  info: 'operator-rail-info',
}

function normalizeSparkline(values?: number[]): number[] {
  if (!values?.length) return []

  const sanitized = values.map((value) => Math.max(0, Number(value) || 0))
  const max = Math.max(...sanitized)
  if (max <= 0) return sanitized.map(() => 0)

  return sanitized.map((value) => Math.max(8, (value / max) * 100))
}

function buildLineSparkline(values?: number[]) {
  if (!values?.length) return null

  const sanitized = values.map((value) => Math.max(0, Number(value) || 0))
  const width = 160
  const height = 32
  const padding = 3
  const max = Math.max(...sanitized)
  const min = Math.min(...sanitized)
  const range = max - min

  const points = sanitized.map((value, index) => {
    const x =
      sanitized.length === 1
        ? width / 2
        : (index / (sanitized.length - 1)) * width
    const normalized = range > 0 ? (value - min) / range : max > 0 ? 0.5 : 0
    const y = height - padding - normalized * (height - padding * 2)

    return { x, y }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  const areaPath = `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`

  return { areaPath, linePath }
}

function MetricSparkline(props: {
  values?: number[]
  variant?: 'bars' | 'line'
}) {
  const rawGradientId = useId()
  const gradientId = `operational-metric-line-${rawGradientId.replace(/:/g, '')}`

  if (props.variant === 'line') {
    const paths = buildLineSparkline(props.values)
    if (!paths) return <div className='h-8' aria-hidden='true' />

    return (
      <div className='text-muted-foreground/70 h-8 overflow-hidden rounded-lg' aria-hidden='true'>
        <svg viewBox='0 0 160 32' preserveAspectRatio='none' className='size-full'>
          <defs>
            <linearGradient id={gradientId} x1='0' x2='0' y1='0' y2='1'>
              <stop offset='0%' stopColor='currentColor' stopOpacity='0.2' />
              <stop offset='100%' stopColor='currentColor' stopOpacity='0' />
            </linearGradient>
          </defs>
          <path d={paths.areaPath} fill={`url(#${gradientId})`} />
          <path
            d={paths.linePath}
            fill='none'
            stroke='currentColor'
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='2'
            vectorEffect='non-scaling-stroke'
          />
        </svg>
      </div>
    )
  }

  const bars = normalizeSparkline(props.values)

  return (
    <div className='flex h-8 items-end gap-1' aria-hidden='true'>
      {bars.map((height, index) => (
        <span
          key={`metric-spark-${index}`}
          className='bg-muted-foreground/25 flex-1 rounded-t-sm'
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  )
}

export function OperationalMetricCard(props: OperationalMetricCardProps) {
  return (
    <div
      className={cn(
        'surface-console rounded-2xl border p-3 sm:p-4',
        toneClassName[props.tone ?? 'neutral'],
        props.className
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='operator-metric-label'>{props.label}</div>
          <div className='mt-2 flex min-w-0 items-baseline gap-1.5'>
            <div className='operator-number truncate text-2xl sm:text-3xl'>
              {props.value}
            </div>
            {props.unit != null && (
              <div className='text-muted-foreground shrink-0 text-xs font-medium'>
                {props.unit}
              </div>
            )}
          </div>
        </div>
        {props.icon != null && (
          <div className='bg-background/70 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl border'>
            {props.icon}
          </div>
        )}
      </div>
      {(props.description != null || props.action != null) && (
        <div className='mt-3 flex items-center justify-between gap-2'>
          {props.description != null && (
            <div className='text-muted-foreground min-w-0 truncate text-xs'>
              {props.description}
            </div>
          )}
          {props.action}
        </div>
      )}
      {props.sparkline != null && (
        <div className='mt-3'>
          <MetricSparkline
            values={props.sparkline}
            variant={props.sparklineVariant}
          />
        </div>
      )}
    </div>
  )
}
