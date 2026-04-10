import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getCurrencyLabel } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

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
  const { t } = useTranslation()
  const currencyLabel = getCurrencyLabel()

  const options = [
    { value: false, label: currencyLabel, icon: null },
    { value: true, label: 'Recharge', icon: Wallet },
  ]

  return (
    <div
      role='group'
      aria-label={t('Select price display mode')}
      className={cn(
        'bg-background inline-flex w-full items-center gap-1 rounded-md border p-1 text-xs shadow-xs sm:w-auto sm:text-sm',
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value
        const Icon = option.icon
        return (
          <Button
            key={String(option.value)}
            variant={isActive ? 'default' : 'ghost'}
            size='sm'
            onClick={() => onChange(option.value)}
            className={cn(
              'h-auto flex-1 gap-1.5 rounded-[calc(theme(borderRadius.md)-2px)] px-2.5 py-1 sm:flex-none sm:px-3',
              isActive
                ? 'shadow-sm'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
            aria-pressed={isActive}
          >
            {Icon && <Icon className='h-3.5 w-3.5' />}
            <span>{option.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
