import { useState } from 'react'
import { Search, RotateCcw, Calendar } from 'lucide-react'
import { getNormalizedDateRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/date-picker'
import { cleanFilters } from '@/features/dashboard/utils'

export interface ModelFilterValues {
  start_timestamp?: Date
  end_timestamp?: Date
  model_name?: string
  token_name?: string
}

interface ModelsFilterProps {
  onFilterChange: (filters: ModelFilterValues) => void
  onReset: () => void
}

const EMPTY_FILTERS: ModelFilterValues = {
  start_timestamp: undefined,
  end_timestamp: undefined,
  model_name: '',
  token_name: '',
}

const TIME_RANGES = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '29D', days: 29 },
] as const

export function ModelsFilter({ onFilterChange, onReset }: ModelsFilterProps) {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<ModelFilterValues>(EMPTY_FILTERS)
  const [selectedRange, setSelectedRange] = useState<number | null>(null)

  const handleApply = () => {
    onFilterChange(cleanFilters(filters))
    setOpen(false)
  }

  const handleReset = () => {
    setFilters(EMPTY_FILTERS)
    setSelectedRange(null)
    onReset()
    setOpen(false)
  }

  const handleChange = (
    field: keyof ModelFilterValues,
    value: Date | string | undefined
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setSelectedRange(null) // 手动选择日期时清除快捷选择
  }

  const handleQuickRange = (days: number) => {
    const { start, end } = getNormalizedDateRange(days)

    setFilters((prev) => ({
      ...prev,
      start_timestamp: start,
      end_timestamp: end,
    }))
    setSelectedRange(days)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm'>
          <Search className='mr-2 h-4 w-4' />
          Filter
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Filter Models Data</DialogTitle>
          <DialogDescription>
            Set filters to narrow down your model statistics and usage data.
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4 py-4'>
          {/* 快捷时间范围选择 */}
          <div className='grid gap-2'>
            <Label className='flex items-center gap-2'>
              <Calendar className='h-4 w-4' />
              Quick Range
            </Label>
            <div className='flex gap-2'>
              {TIME_RANGES.map((range) => (
                <Button
                  key={range.days}
                  type='button'
                  size='sm'
                  variant={selectedRange === range.days ? 'default' : 'outline'}
                  onClick={() => handleQuickRange(range.days)}
                  className={cn(
                    'flex-1',
                    selectedRange === range.days &&
                      'ring-ring ring-2 ring-offset-2'
                  )}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </div>

          <div className='relative'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-background text-muted-foreground px-2'>
                Or customize
              </span>
            </div>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='start_timestamp'>Start Time</Label>
            <DatePicker
              selected={filters.start_timestamp}
              onSelect={(date) => handleChange('start_timestamp', date)}
              placeholder='Select start date'
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='end_timestamp'>End Time</Label>
            <DatePicker
              selected={filters.end_timestamp}
              onSelect={(date) => handleChange('end_timestamp', date)}
              placeholder='Select end date'
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='model_name'>Model Name</Label>
            <Input
              id='model_name'
              placeholder='e.g. gpt-4'
              value={filters.model_name}
              onChange={(e) => handleChange('model_name', e.target.value)}
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='token_name'>Token Name</Label>
            <Input
              id='token_name'
              placeholder='Optional'
              value={filters.token_name}
              onChange={(e) => handleChange('token_name', e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleReset} variant='outline' type='button'>
            <RotateCcw className='mr-2 h-4 w-4' />
            Reset
          </Button>
          <Button onClick={handleApply} type='submit'>
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
