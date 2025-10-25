import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// ----------------------------------------------------------------------------
// Filter Section Component
// ----------------------------------------------------------------------------

export interface FilterSectionProps {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function FilterSection({
  title,
  isOpen,
  onToggle,
  children,
}: FilterSectionProps) {
  return (
    <div className='border-border/40 border-b py-4'>
      <button
        onClick={onToggle}
        className='hover:text-foreground text-foreground/80 mb-3 flex w-full items-center justify-between text-sm font-medium transition-colors'
        aria-expanded={isOpen}
        aria-controls={`filter-section-${title}`}
      >
        {title}
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && (
        <div id={`filter-section-${title}`} className='space-y-2'>
          {children}
        </div>
      )}
    </div>
  )
}
