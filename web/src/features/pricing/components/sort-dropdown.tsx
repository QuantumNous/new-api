import { ChevronsUpDown, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getSortLabels, type SortOption } from '../constants'

// ----------------------------------------------------------------------------
// Sort Dropdown Component
// ----------------------------------------------------------------------------

export interface SortDropdownProps {
  value: string
  onValueChange: (value: string) => void
}

export function SortDropdown({ value, onValueChange }: SortDropdownProps) {
  const { t } = useTranslation()
  const sortLabels = getSortLabels(t)
  const currentLabel = sortLabels[value as SortOption] || t('Sort')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          className='hover:bg-accent gap-2 px-3 font-normal'
        >
          <span className='text-sm'>{currentLabel}</span>
          <ChevronsUpDown className='text-muted-foreground h-4 w-4 opacity-50' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[200px]'>
        {Object.entries(sortLabels).map(([sortValue, label]) => (
          <DropdownMenuItem
            key={sortValue}
            onClick={() => onValueChange(sortValue)}
            className='gap-2'
          >
            <Check
              className={cn(value === sortValue ? 'opacity-100' : 'opacity-0')}
            />
            <span>{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
