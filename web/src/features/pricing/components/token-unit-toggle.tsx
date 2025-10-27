import { cn } from '@/lib/utils'
import type { TokenUnit } from '../types'

const TOKEN_UNIT_OPTIONS: Array<{ value: TokenUnit; label: string }> = [
  { value: 'M', label: '1M tokens' },
  { value: 'K', label: '1K tokens' },
]

export interface TokenUnitToggleProps {
  value: TokenUnit
  onChange: (value: TokenUnit) => void
  className?: string
}

export function TokenUnitToggle({
  value,
  onChange,
  className,
}: TokenUnitToggleProps) {
  return (
    <div
      role='group'
      aria-label='Select token display unit'
      className={cn(
        'bg-background inline-flex w-full items-center gap-1 rounded-md border p-1 text-xs shadow-xs sm:w-auto sm:text-sm',
        className
      )}
    >
      {TOKEN_UNIT_OPTIONS.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type='button'
            onClick={() => onChange(option.value)}
            className={cn(
              'focus-visible:outline-ring inline-flex flex-1 items-center justify-center rounded-[calc(theme(borderRadius.md)-2px)] px-2.5 py-1 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-none sm:px-3',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
