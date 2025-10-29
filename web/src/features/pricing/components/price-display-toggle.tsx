import { Wallet } from 'lucide-react'
import { getCurrencyLabel } from '@/lib/currency'
import { cn } from '@/lib/utils'

export interface PriceDisplayToggleProps {
  value: boolean
  onChange: (value: boolean) => void
  className?: string
}

export function PriceDisplayToggle({
  value,
  onChange,
  className,
}: PriceDisplayToggleProps) {
  const currencyLabel = getCurrencyLabel()

  const options = [
    { value: false, label: currencyLabel, icon: null },
    { value: true, label: 'Recharge', icon: Wallet },
  ]

  return (
    <div
      role='group'
      aria-label='Select price display mode'
      className={cn(
        'bg-background inline-flex w-full items-center gap-1 rounded-md border p-1 text-xs shadow-xs sm:w-auto sm:text-sm',
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value
        const Icon = option.icon
        return (
          <button
            key={String(option.value)}
            type='button'
            onClick={() => onChange(option.value)}
            className={cn(
              'focus-visible:outline-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-[calc(theme(borderRadius.md)-2px)] px-2.5 py-1 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-none sm:px-3',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
            aria-pressed={isActive}
          >
            {Icon && <Icon className='h-3.5 w-3.5' />}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
