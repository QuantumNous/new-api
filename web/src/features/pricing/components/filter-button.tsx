import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ----------------------------------------------------------------------------
// Filter Button Component
// ----------------------------------------------------------------------------

export interface FilterButtonProps {
  children: React.ReactNode
  isActive: boolean
  onClick: () => void
  icon?: React.ReactNode
}

export function FilterButton({
  children,
  isActive,
  onClick,
  icon,
}: FilterButtonProps) {
  return (
    <Button
      variant='ghost'
      onClick={onClick}
      className={cn(
        'h-auto w-full justify-start px-3 py-1.5 font-normal',
        isActive && 'bg-accent text-accent-foreground font-medium'
      )}
    >
      {icon && <span className='shrink-0'>{icon}</span>}
      <span className='truncate'>{children}</span>
    </Button>
  )
}
