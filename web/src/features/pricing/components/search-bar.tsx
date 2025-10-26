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
      <Search className='text-muted-foreground/70 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='border-border/60 bg-muted/30 placeholder:text-muted-foreground/60 hover:border-border hover:bg-muted/50 focus-visible:bg-background rounded-lg pr-10 pl-10 text-sm transition-colors'
      />
      {value && (
        <button
          onClick={onClear}
          className='text-muted-foreground/70 hover:text-foreground hover:bg-muted absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 transition-colors'
          aria-label='Clear search'
        >
          <X className='h-4 w-4' />
        </button>
      )}
    </div>
  )
}
