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
import { useId } from 'react'
import { cn } from '@/lib/utils'

interface OverviewSparklineProps {
  values?: number[]
  className?: string
  stroke?: string
  fill?: string
  width?: number
  height?: number
}

function buildPaths(values: number[], width: number, height: number) {
  if (!values?.length) return null

  const sanitized = values.map((v) => Math.max(0, Number(v) || 0))
  const max = Math.max(...sanitized)
  const min = Math.min(...sanitized)
  const range = max - min
  const padding = 3

  const points = sanitized.map((value, index) => {
    const x =
      sanitized.length === 1
        ? width / 2
        : (index / (sanitized.length - 1)) * width
    const normalized =
      range > 0 ? (value - min) / range : max > 0 ? 0.5 : 0
    const y = height - padding - normalized * (height - padding * 2)
    return { x, y }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  const areaPath = `${linePath} L ${last.x} ${height} L ${first.x} ${height} Z`

  return { linePath, areaPath }
}

export function OverviewSparkline(props: OverviewSparklineProps) {
  const rawId = useId()
  const gradientId = `overview-spark-${rawId.replace(/:/g, '')}`
  const width = props.width ?? 96
  const height = props.height ?? 36
  const paths = buildPaths(props.values ?? [], width, height)
  const stroke = props.stroke ?? '#3B82F6'
  const fill = props.fill ?? stroke

  if (!paths) {
    return (
      <div
        className={cn('relative shrink-0', props.className)}
        style={{ width, height }}
        aria-hidden='true'
      >
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none' className='size-full'>
          <path
            d={`M 0 ${height * 0.65} L ${width} ${height * 0.65}`}
            fill='none'
            stroke={stroke}
            strokeOpacity='0.22'
            strokeWidth='1.5'
            strokeDasharray='3 3'
          />
        </svg>
      </div>
    )
  }

  return (
    <div
      className={cn('shrink-0 overflow-hidden', props.className)}
      style={{ width, height }}
      aria-hidden='true'
    >
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none' className='size-full'>
        <defs>
          <linearGradient id={gradientId} x1='0' x2='0' y1='0' y2='1'>
            <stop offset='0%' stopColor={fill} stopOpacity='0.18' />
            <stop offset='100%' stopColor={fill} stopOpacity='0' />
          </linearGradient>
        </defs>
        <path d={paths.areaPath} fill={`url(#${gradientId})`} />
        <path
          d={paths.linePath}
          fill='none'
          stroke={stroke}
          strokeWidth='2'
          vectorEffect='non-scaling-stroke'
        />
      </svg>
    </div>
  )
}

/** Vertical mini bars for channel health KPI (reference style) */
export function OverviewMiniBars(props: {
  segments: { count: number; color: string }[]
  className?: string
}) {
  const total = props.segments.reduce((s, seg) => s + seg.count, 0) || 1
  const maxH = 30

  return (
    <div
      className={cn('flex h-8 w-22 items-end justify-end gap-0.5', props.className)}
      aria-hidden='true'
    >
      {props.segments.map((seg, i) => {
        const h = Math.max(4, Math.round((seg.count / total) * maxH))
        return (
          <span
            key={i}
            className='w-1.5 rounded-t-sm'
            style={{ height: h, backgroundColor: seg.color }}
          />
        )
      })}
    </div>
  )
}

export function computeDayOverDayChange(
  current: number,
  prior: number
): { pct: number | null; direction: 'up' | 'down' | 'flat' } {
  if (current === 0 && prior === 0) return { pct: null, direction: 'flat' }
  if (prior === 0) return { pct: 100, direction: 'up' }
  const pct = ((current - prior) / prior) * 100
  if (Math.abs(pct) < 0.05) return { pct: 0, direction: 'flat' }
  return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : 'down' }
}
