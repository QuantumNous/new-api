/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | null
  description: string
  icon: LucideIcon
  loading?: boolean
  trackingFailed?: boolean
  className?: string
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
  trackingFailed,
  className,
}: MetricCardProps) {
  const { t } = useTranslation()

  const displayValue =
    trackingFailed || value === null ? '—' : value

  const displayDesc =
    trackingFailed
      ? t('Tracking unavailable')
      : value === null
        ? t('No data in this period')
        : description

  return (
    <div
      className={cn(
        'bg-background/60 flex min-h-32 flex-col justify-between gap-3 rounded-xl border p-3',
        className
      )}
    >
      <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
        <Icon
          className='text-muted-foreground/60 size-3.5 shrink-0'
          aria-hidden='true'
        />
        <span className='line-clamp-2 leading-snug'>{title}</span>
      </div>

      {loading ? (
        <div className='flex flex-col gap-1.5'>
          <Skeleton className='h-7 w-24' />
          <Skeleton className='h-3.5 w-32' />
        </div>
      ) : (
        <div className='flex flex-col gap-1'>
          <div
            className={cn(
              'font-mono text-2xl font-semibold tracking-tight break-all tabular-nums',
              displayValue === '—'
                ? 'text-muted-foreground/40'
                : 'text-foreground'
            )}
          >
            {displayValue}
          </div>
          <p className='text-muted-foreground/60 text-xs leading-relaxed'>
            {displayDesc}
          </p>
        </div>
      )}

      {/* Placeholder sparkline bar so card height is consistent */}
      <div className='flex h-8 items-end gap-1' aria-hidden='true'>
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className='flex-1 rounded-t-sm bg-linear-to-t from-muted-foreground/20 via-muted-foreground/10 to-transparent opacity-20'
            style={{ height: '20%' }}
          />
        ))}
      </div>
    </div>
  )
}
