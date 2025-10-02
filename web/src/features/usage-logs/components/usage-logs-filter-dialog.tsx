import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search, RotateCcw, Calendar } from 'lucide-react'
import { getSelf } from '@/lib/api'
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
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DateTimePicker } from '@/components/datetime-picker'
import { TIME_RANGE_PRESETS } from '../data/data'
import { getDefaultTimeRange } from '../lib/utils'

interface LogFilters {
  startTime?: Date
  endTime?: Date
  model?: string
  token?: string
  group?: string
  channel?: string
  username?: string
}

interface UsageLogsFilterDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onFilterChange?: (filters: LogFilters) => void
}

export function UsageLogsFilterDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onFilterChange,
}: UsageLogsFilterDialogProps) {
  const navigate = useNavigate()
  const [self, setSelf] = useState<any>(null)
  const [internalOpen, setInternalOpen] = useState(false)

  const open = controlledOpen ?? internalOpen
  const setOpen = controlledOnOpenChange ?? setInternalOpen

  // Load user data to check if admin
  useEffect(() => {
    getSelf()
      .then((res) => {
        setSelf(res?.data || null)
      })
      .catch(() => {})
  }, [])

  const isAdmin = self?.role && self.role >= 10

  const [filters, setFilters] = useState<LogFilters>(() => {
    const { start, end } = getDefaultTimeRange()
    return {
      startTime: start,
      endTime: end,
    }
  })
  const [selectedRange, setSelectedRange] = useState<number | null>(null)

  const handleApply = () => {
    // Convert dates to timestamps and navigate
    const searchParams: Record<string, any> = {}

    if (filters.startTime) {
      searchParams.startTime = filters.startTime.getTime()
    }
    if (filters.endTime) {
      searchParams.endTime = filters.endTime.getTime()
    }
    if (filters.model) {
      searchParams.model = filters.model
    }
    if (filters.token) {
      searchParams.token = filters.token
    }
    if (filters.group) {
      searchParams.group = filters.group
    }
    if (filters.channel) {
      searchParams.channel = filters.channel
    }
    if (filters.username) {
      searchParams.username = filters.username
    }

    navigate({
      to: '/usage-logs',
      search: searchParams,
    })

    onFilterChange?.(filters)
    setOpen(false)
  }

  const handleReset = () => {
    const { start, end } = getDefaultTimeRange()

    setFilters({
      startTime: start,
      endTime: end,
    })
    setSelectedRange(null)

    // Reset URL params to default (today's range)
    navigate({
      to: '/usage-logs',
      search: {
        startTime: start.getTime(),
        endTime: end.getTime(),
      },
    })

    onFilterChange?.({
      startTime: start,
      endTime: end,
    })
    setOpen(false)
  }

  const handleChange = (
    field: keyof LogFilters,
    value: Date | string | undefined
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    if (field === 'startTime' || field === 'endTime') {
      setSelectedRange(null) // 手动选择日期时清除快捷选择
    }
  }

  const handleQuickRange = (days: number) => {
    const { start, end } = getNormalizedDateRange(days)

    setFilters((prev) => ({
      ...prev,
      startTime: start,
      endTime: end,
    }))
    setSelectedRange(days)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='sm:max-w-[550px]'>
        <DialogHeader>
          <DialogTitle>Filter Usage Logs</DialogTitle>
          <DialogDescription>
            Set filters to narrow down your log search results.
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

            <div className='relative'>
              <div className='absolute inset-0 flex items-center'>
                <span className='w-full border-t' />
              </div>
              <div className='relative flex justify-center text-xs uppercase'>
                <span className='bg-background text-muted-foreground px-2'>
                  Custom Time Range
                </span>
              </div>
            </div>

            {/* 自定义时间范围 */}
            <div className='grid gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='start_time'>Start Time</Label>
                <DateTimePicker
                  value={filters.startTime}
                  onChange={(date) =>
                    handleChange('startTime', date || undefined)
                  }
                  placeholder='Select start time'
                />
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='end_time'>End Time</Label>
                <DateTimePicker
                  value={filters.endTime}
                  onChange={(date) =>
                    handleChange('endTime', date || undefined)
                  }
                  placeholder='Select end time'
                />
              </div>
            </div>

            <div className='relative'>
              <div className='absolute inset-0 flex items-center'>
                <span className='w-full border-t' />
              </div>
              <div className='relative flex justify-center text-xs uppercase'>
                <span className='bg-background text-muted-foreground px-2'>
                  Log Filters
                </span>
              </div>
            </div>

            {/* 模型名称 */}
            <div className='grid gap-2'>
              <Label htmlFor='model'>Model Name</Label>
              <Input
                id='model'
                placeholder='e.g., gpt-4, claude-3'
                value={filters.model || ''}
                onChange={(e) => handleChange('model', e.target.value)}
              />
            </div>

            {/* 令牌名称 */}
            <div className='grid gap-2'>
              <Label htmlFor='token'>Token Name</Label>
              <Input
                id='token'
                placeholder='Filter by token name'
                value={filters.token || ''}
                onChange={(e) => handleChange('token', e.target.value)}
              />
            </div>

            {/* 分组 */}
            <div className='grid gap-2'>
              <Label htmlFor='group'>Group</Label>
              <Input
                id='group'
                placeholder='Filter by group'
                value={filters.group || ''}
                onChange={(e) => handleChange('group', e.target.value)}
              />
            </div>

            {/* 管理员专属字段 */}
            {isAdmin && (
              <>
                <div className='relative'>
                  <div className='absolute inset-0 flex items-center'>
                    <span className='w-full border-t' />
                  </div>
                  <div className='relative flex justify-center text-xs uppercase'>
                    <span className='bg-background text-muted-foreground px-2'>
                      Admin Only
                    </span>
                  </div>
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='channel'>Channel ID</Label>
                  <Input
                    id='channel'
                    placeholder='Filter by channel ID'
                    value={filters.channel || ''}
                    onChange={(e) => handleChange('channel', e.target.value)}
                  />
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='username'>Username</Label>
                  <Input
                    id='username'
                    placeholder='Filter by username'
                    value={filters.username || ''}
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
