import { useState, useEffect } from 'react'
import { Search, RotateCcw, Calendar } from 'lucide-react'
import { getSelf } from '@/lib/api'
import { getNormalizedDateRange, type TimeGranularity } from '@/lib/time'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/date-picker'
import {
  type DashboardFilters,
  TIME_GRANULARITY_OPTIONS,
  TIME_RANGE_PRESETS,
  EMPTY_DASHBOARD_FILTERS,
} from '@/features/dashboard/types'
import { cleanFilters } from '@/features/dashboard/utils'

interface ModelsFilterProps {
  onFilterChange: (filters: DashboardFilters) => void
  onReset: () => void
}

export function ModelsFilter({ onFilterChange, onReset }: ModelsFilterProps) {
  const [self, setSelf] = useState<any>(null)

  // Load user data to check if admin
  useEffect(() => {
    getSelf()
      .then((res) => {
        setSelf(res?.data || null)
      })
      .catch(() => {})
  }, [])

  const isAdmin = self?.role && self.role >= 10

  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    // 默认使用最近 14 天
    const { start, end } = getNormalizedDateRange(14)
    return {
      ...EMPTY_DASHBOARD_FILTERS,
      start_timestamp: start,
      end_timestamp: end,
    }
  })
  const [selectedRange, setSelectedRange] = useState<number | null>(14)

  const handleApply = () => {
    onFilterChange(cleanFilters(filters))
    setOpen(false)
  }

  const handleReset = () => {
    const { start, end } = getNormalizedDateRange(14)
    setFilters({
      ...EMPTY_DASHBOARD_FILTERS,
      start_timestamp: start,
      end_timestamp: end,
    })
    setSelectedRange(14)
    onReset()
    setOpen(false)
  }

  const handleChange = (
    field: keyof DashboardFilters,
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
          <DialogTitle>Filter Time Range</DialogTitle>
          <DialogDescription>
            Select a time range to filter your dashboard statistics.
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
              {TIME_RANGE_PRESETS.map((range) => (
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
            <Label htmlFor='time_granularity'>Time Granularity</Label>
            <Select
              value={filters.time_granularity}
              onValueChange={(value) =>
                handleChange('time_granularity', value as TimeGranularity)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='Select time granularity' />
              </SelectTrigger>
              <SelectContent>
                {TIME_GRANULARITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isAdmin && (
            <div className='grid gap-2'>
              <Label htmlFor='username'>Username</Label>
              <Input
                id='username'
                placeholder='Optional (admin only)'
                value={filters.username}
                onChange={(e) => handleChange('username', e.target.value)}
              />
            </div>
          )}
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
