import { cn } from '@/lib/utils'

type GrowthTextProps = {
  value: number
  className?: string
}

/**
 * Render a period-over-period growth percent as `↑303%`, `↓12.4%`, or
 * `0%` (when no change). The arrow is encoded in the text so the value
 * still aligns inside a tabular column.
 */
export function GrowthText(props: GrowthTextProps) {
  const v = props.value
  if (!Number.isFinite(v) || v === 0) {
    return (
      <span
        className={cn(
          'text-muted-foreground/80 font-mono tabular-nums',
          props.className
        )}
      >
        0%
      </span>
    )
  }
  const isUp = v > 0
  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        isUp
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400',
        props.className
      )}
    >
      {isUp ? '↑' : '↓'}
      {Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1)}%
    </span>
  )
}
