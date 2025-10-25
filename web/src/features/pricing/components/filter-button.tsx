import { cn } from '@/lib/utils'

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
    <button
      onClick={onClick}
      className={cn(
        'hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors',
        isActive && 'bg-accent text-accent-foreground font-medium'
      )}
    >
      {icon && <span className='shrink-0'>{icon}</span>}
      <span className='truncate'>{children}</span>
    </button>
  )
}
