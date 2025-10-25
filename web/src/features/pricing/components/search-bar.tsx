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
      <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2' />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='h-12 pr-12 pl-12 text-base'
      />
      {value && (
        <button
          onClick={onClear}
          className='text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 transition-colors'
          aria-label='Clear search'
        >
          <X className='h-4 w-4' />
        </button>
      )}
    </div>
  )
}
