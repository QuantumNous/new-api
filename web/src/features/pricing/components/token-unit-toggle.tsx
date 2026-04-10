import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
  const { t } = useTranslation()
  return (
    <div
      role='group'
      aria-label={t('Select token display unit')}
      className={cn(
        'bg-background inline-flex w-full items-center gap-1 rounded-md border p-1 text-xs shadow-xs sm:w-auto sm:text-sm',
        className
      )}
    >
      {TOKEN_UNIT_OPTIONS.map((option) => {
        const isActive = option.value === value
        return (
          <Button
            key={option.value}
            variant={isActive ? 'default' : 'ghost'}
            size='sm'
            onClick={() => onChange(option.value)}
            className={cn(
              'h-auto flex-1 rounded-[calc(theme(borderRadius.md)-2px)] px-2.5 py-1 sm:flex-none sm:px-3',
              isActive
                ? 'shadow-sm'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
            aria-pressed={isActive}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
