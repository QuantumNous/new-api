import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CHANNEL_STATUS_OPTIONS, CHANNEL_TYPE_OPTIONS } from '../constants'

interface ChannelsFilterBarProps {
  keyword: string
  onKeywordChange: (keyword: string) => void
  status: string
  onStatusChange: (status: string) => void
  type: string
  onTypeChange: (type: string) => void
  onReset: () => void
}

export function ChannelsFilterBar({
  keyword,
  onKeywordChange,
  status,
  onStatusChange,
  type,
  onTypeChange,
  onReset,
}: ChannelsFilterBarProps) {
  const hasFilters =
    keyword || (status !== 'all' && status) || (type !== 'all' && type)

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
      {/* Keyword Search */}
      <div className='relative flex-1'>
        <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
        <Input
          placeholder='Search by name, ID, or key...'
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          className='pl-9'
        />
      </div>

      {/* Status Filter */}
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className='w-full sm:w-[160px]'>
          <SelectValue placeholder='All Status' />
        </SelectTrigger>
        <SelectContent>
          {CHANNEL_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Type Filter */}
      <Select value={type} onValueChange={onTypeChange}>
        <SelectTrigger className='w-full sm:w-[160px]'>
          <SelectValue placeholder='All Types' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>All Types</SelectItem>
          {CHANNEL_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Reset Button */}
      {hasFilters && (
        <Button variant='ghost' size='sm' onClick={onReset} className='h-10'>
          <X className='mr-1.5 h-4 w-4' />
          Reset
        </Button>
      )}
    </div>
  )
}
