import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatLatency, formatThroughput } from '../lib/mock-stats'

export type ModelPerfBadgeData = {
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
}

export interface ModelPerfBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  perf: ModelPerfBadgeData | undefined
}

function formatCompactThroughput(tps: number): string {
  return formatThroughput(tps).replace(' t/s', 'tps')
}

export const ModelPerfBadge = memo(function ModelPerfBadge(
  props: ModelPerfBadgeProps
) {
  const { t } = useTranslation()

  if (!props.perf) {
    return null
  }

  const { avg_latency_ms, avg_tps, success_rate } = props.perf

  let statusColor = 'bg-emerald-500'
  if (success_rate < 99) {
    statusColor = 'bg-red-500'
  } else if (success_rate < 99.9) {
    statusColor = 'bg-amber-500'
  }

  return (
    <div
      className={cn(
        'hidden w-[132px] grid-cols-[38px_48px_30px] gap-x-2 text-right tabular-nums min-[460px]:grid',
        props.className
      )}
    >
      <div title={t('Average latency')} className='min-w-0'>
        <div className='text-muted-foreground/55 text-[10px] leading-4'>
          {t('Latency short')}
        </div>
        <div className='text-muted-foreground/80 font-mono text-xs leading-4 whitespace-nowrap'>
          {avg_latency_ms > 0 ? formatLatency(avg_latency_ms) : '—'}
        </div>
      </div>
      <div title={t('Throughput')} className='min-w-0'>
        <div className='text-muted-foreground/55 truncate text-[10px] leading-4'>
          {t('Throughput short')}
        </div>
        <div className='text-muted-foreground/80 font-mono text-xs leading-4 whitespace-nowrap'>
          {formatCompactThroughput(avg_tps)}
        </div>
      </div>
      <div
        title={`${t('Success rate')}: ${success_rate.toFixed(1)}%`}
        className='min-w-0'
      >
        <div className='text-muted-foreground/55 truncate text-[10px] leading-4'>
          {t('Status short')}
        </div>
        <div className='flex h-4 items-center justify-end gap-0.5'>
          <span className='bg-muted-foreground/10 h-2 w-1 rounded-full' />
          <span className='bg-muted-foreground/15 h-2.5 w-1 rounded-full' />
          <span className={cn('h-3 w-1 rounded-full', statusColor)} />
        </div>
      </div>
    </div>
  )
})
