import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

// ----------------------------------------------------------------------------
// Search Bar Component
// ----------------------------------------------------------------------------

export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder?: string
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search models...',
}: SearchBarProps) {
  return (
    <div className='relative'>
      <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 sm:left-4 sm:h-5 sm:w-5' />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='h-10 pr-10 pl-10 text-sm sm:h-12 sm:pr-12 sm:pl-12 sm:text-base'
      />
      {value && (
        <button
          onClick={onClear}
          className='text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 transition-colors sm:right-3'
          aria-label='Clear search'
        >
          <X className='h-3.5 w-3.5 sm:h-4 sm:w-4' />
        </button>
      )}
    </div>
  )
}
