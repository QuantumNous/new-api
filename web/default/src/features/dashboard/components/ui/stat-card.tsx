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
import type { ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type StatCardTone = 'rose' | 'teal' | 'gray'

interface StatCardProps {
  title: string
  value: string | number
  description: string
  icon: LucideIcon
  sparkline?: number[]
  tone?: StatCardTone
  loading?: boolean
  error?: boolean
  action?: ReactNode
}

const TONE_CLASSES: Record<StatCardTone, string> = {
  rose: 'from-rose-500/80 via-rose-300/70 to-rose-200/20 dark:from-rose-400/70 dark:via-rose-500/30 dark:to-rose-500/5',
  teal: 'from-teal-500/80 via-teal-300/70 to-teal-200/20 dark:from-teal-400/70 dark:via-teal-500/30 dark:to-teal-500/5',
  gray: 'from-muted-foreground/50 via-muted-foreground/20 to-transparent dark:from-muted-foreground/40 dark:via-muted-foreground/20',
}

function normalizeSparkline(values?: number[]): number[] {
  if (!values?.length) return []

  const sanitized = values.map((value) => Math.max(0, Number(value) || 0))
  const max = Math.max(...sanitized)
  if (max <= 0) return sanitized.map(() => 0)

  return sanitized.map((value) => Math.max(8, (value / max) * 100))
}

export function StatCard(props: StatCardProps) {
  const Icon = props.icon
  const tone = props.tone ?? 'gray'
  const sparkline = normalizeSparkline(props.sparkline)

  return (
    <div className='group flex min-h-32 flex-col justify-between gap-3'>
      <div className='flex items-start justify-between gap-1'>
        <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium sm:gap-2'>
          <Icon
            className='text-muted-foreground/60 size-3.5 shrink-0'
            aria-hidden='true'
          />
          <span className='line-clamp-2 leading-snug'>{props.title}</span>
        </div>
        {props.action && <div className='shrink-0'>{props.action}</div>}
      </div>

      {props.loading ? (
        <div className='flex flex-col gap-1.5'>
          <Skeleton className='h-7 w-24' />
          <Skeleton className='h-3.5 w-32' />
        </div>
      ) : props.error ? (
        <div className='flex flex-col gap-1'>
          <div className='text-muted-foreground mt-0.5 font-mono text-base font-bold tracking-tight break-all tabular-nums sm:text-2xl'>
            --
          </div>
          <p className='text-muted-foreground/60 text-xs'>
            {props.description}
          </p>
        </div>
      ) : (
        <div className='flex flex-col gap-1'>
          <div className='text-foreground font-mono text-2xl font-semibold tracking-tight break-all tabular-nums'>
            {props.value}
          </div>
          <p className='text-muted-foreground/60 text-xs leading-relaxed'>
            {props.description}
          </p>
        </div>
      )}

      <div className='flex h-8 items-end gap-1' aria-hidden='true'>
        {sparkline.map((height, index) => (
          <span
            key={`${props.title}-spark-${index}`}
            className={cn(
              'flex-1 rounded-t-sm bg-linear-to-t',
              height <= 0 && 'opacity-20',
              TONE_CLASSES[tone]
            )}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  )
}
