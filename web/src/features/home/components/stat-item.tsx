import { cn } from '@/lib/utils'

interface StatItemProps {
  value: string | number
  suffix?: string
  description?: string
}

const GRADIENT_TEXT =
  'from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text font-bold text-transparent'

/**
 * Individual stat item with value, suffix, and description
 */
export function StatItem({ value, suffix, description }: StatItemProps) {
  return (
    <div className='flex flex-col items-center gap-2 text-center'>
      <div className='flex items-baseline gap-1'>
        <div
          className={cn(
            GRADIENT_TEXT,
            'text-4xl drop-shadow-sm transition-all duration-300 sm:text-5xl md:text-6xl'
          )}
        >
          {value}
        </div>
        {suffix && (
          <div
            className={cn(GRADIENT_TEXT, 'text-3xl sm:text-4xl md:text-5xl')}
          >
            {suffix}
          </div>
        )}
      </div>
      {description && (
        <p className='text-muted-foreground text-sm font-medium'>
          {description}
        </p>
      )}
    </div>
  )
}
