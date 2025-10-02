import { useState, useEffect } from 'react'
import { Filter, RotateCcw, Calendar, Search } from 'lucide-react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateTimePicker } from '@/components/datetime-picker'
import { DEFAULT_TIME_RANGE_DAYS } from '@/features/dashboard/constants'
import { cleanFilters } from '@/features/dashboard/lib'
import {
  type DashboardFilters,
  TIME_GRANULARITY_OPTIONS,
  TIME_RANGE_PRESETS,
  EMPTY_DASHBOARD_FILTERS,
} from '@/features/dashboard/types'

interface ModelsFilterProps {
  onFilterChange: (filters: DashboardFilters) => void
  onReset: () => void
}

/**
 * Section divider component for better visual organization
 */
const SectionDivider = ({ label }: { label: string }) => (
  <div className='relative'>
    <div className='absolute inset-0 flex items-center'>
      <span className='w-full border-t' />
    </div>
    <div className='relative flex justify-center text-xs uppercase'>
      <span className='bg-background text-muted-foreground px-2'>{label}</span>
    </div>
  </div>
)

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
    const { start, end } = getNormalizedDateRange(DEFAULT_TIME_RANGE_DAYS)
    return {
      ...EMPTY_DASHBOARD_FILTERS,
      start_timestamp: start,
      end_timestamp: end,
    }
  })
  const [selectedRange, setSelectedRange] = useState<number | null>(
    DEFAULT_TIME_RANGE_DAYS
  )

  const handleApply = () => {
    onFilterChange(cleanFilters(filters))
    setOpen(false)
  }

  const handleReset = () => {
    const { start, end } = getNormalizedDateRange(DEFAULT_TIME_RANGE_DAYS)
    setFilters({
      ...EMPTY_DASHBOARD_FILTERS,
      start_timestamp: start,
      end_timestamp: end,
    })
    setSelectedRange(DEFAULT_TIME_RANGE_DAYS)
    onReset()
    setOpen(false)
  }

  const handleChange = (
    field: keyof DashboardFilters,
    value: Date | string | undefined
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    // Clear quick range selection when manually changing time fields
    if (field === 'start_timestamp' || field === 'end_timestamp') {
      setSelectedRange(null)
    }
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
          <Filter className='mr-2 h-4 w-4' />
          Filter
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[550px]'>
        <DialogHeader>
          <DialogTitle>Filter Dashboard Models</DialogTitle>
          <DialogDescription>
            Set filters to customize your dashboard statistics and charts.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[60vh] pr-4'>
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
                    variant={
                      selectedRange === range.days ? 'default' : 'outline'
                    }
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

            <SectionDivider label='Custom Time Range' />

            {/* 自定义时间范围 */}
            <div className='grid gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='start_timestamp'>Start Time</Label>
                <DateTimePicker
                  value={filters.start_timestamp}
                  onChange={(date) =>
                    handleChange('start_timestamp', date || undefined)
                  }
                  placeholder='Select start time'
                />
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='end_timestamp'>End Time</Label>
                <DateTimePicker
                  value={filters.end_timestamp}
                  onChange={(date) =>
                    handleChange('end_timestamp', date || undefined)
                  }
                  placeholder='Select end time'
                />
              </div>
            </div>

            <SectionDivider label='Chart Settings' />

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

            {/* 管理员专属字段 */}
            {isAdmin && (
              <>
                <SectionDivider label='Admin Only' />

                <div className='grid gap-2'>
                  <Label htmlFor='username'>Username</Label>
                  <Input
                    id='username'
                    placeholder='Filter by username'
                    value={filters.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleReset} variant='outline' type='button'>
            <RotateCcw className='mr-2 h-4 w-4' />
            Reset
          </Button>
          <Button onClick={handleApply} type='submit'>
            <Search className='mr-2 h-4 w-4' />
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
