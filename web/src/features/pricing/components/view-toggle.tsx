import { List, Table } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { VIEW_MODES, type ViewMode } from '../constants'

const VIEW_TOGGLE_OPTIONS: Array<{
  value: ViewMode
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: VIEW_MODES.LIST, icon: List },
  { value: VIEW_MODES.TABLE, icon: Table },
]

export interface ViewToggleProps {
  value: ViewMode
  onChange: (value: ViewMode) => void
  className?: string
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  const { t } = useTranslation()
  return (
    <div
      role='group'
      aria-label={t('Select view mode')}
      className={cn(
        'bg-background inline-flex w-full items-center gap-1 rounded-md border p-1 text-xs shadow-xs sm:w-auto sm:text-sm',
        className
      )}
    >
      {VIEW_TOGGLE_OPTIONS.map((option) => {
        const isActive = option.value === value
        const Icon = option.icon
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
            <Icon className='h-4 w-4' />
          </Button>
        )
      })}
    </div>
  )
}
