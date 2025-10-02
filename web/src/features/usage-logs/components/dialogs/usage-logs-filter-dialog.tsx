import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search, RotateCcw, Calendar } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
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
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DateTimePicker } from '@/components/datetime-picker'
import { TIME_RANGE_PRESETS } from '../../constants'
import {
  buildSearchParams,
  getLogCategoryLabel,
  type LogFilters,
  type CommonLogFilters,
  type DrawingLogFilters,
  type TaskLogFilters,
} from '../../lib/filter'
import { getDefaultTimeRange } from '../../lib/utils'
import type { LogCategory } from '../usage-logs-tabs'
import { FilterInput, SectionDivider } from './filter-components'

interface UsageLogsFilterDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onFilterChange?: (filters: LogFilters) => void
  logCategory: LogCategory
}

export function UsageLogsFilterDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onFilterChange,
  logCategory,
}: UsageLogsFilterDialogProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore((state) => state.auth)
  const isAdmin = (user?.role ?? 0) >= ROLE.ADMIN
  const [internalOpen, setInternalOpen] = useState(false)

  const open = controlledOpen ?? internalOpen
  const setOpen = controlledOnOpenChange ?? setInternalOpen

  const [filters, setFilters] = useState<LogFilters>(() => {
    const { start, end } = getDefaultTimeRange()
    return { startTime: start, endTime: end }
  })
  const [selectedRange, setSelectedRange] = useState<number | null>(null)

  // Reset category-specific filters when log category changes
  useEffect(() => {
    setFilters((prev) => ({
      startTime: prev.startTime,
      endTime: prev.endTime,
      channel: prev.channel,
    }))
  }, [logCategory])

  const handleChange = useCallback(
    (field: string, value: Date | string | undefined) => {
      setFilters((prev) => ({ ...prev, [field]: value }))
      if (field === 'startTime' || field === 'endTime') {
        setSelectedRange(null)
      }
    },
    []
  )

  const handleQuickRange = useCallback((days: number) => {
    const { start, end } = getNormalizedDateRange(days)
    setFilters((prev) => ({ ...prev, startTime: start, endTime: end }))
    setSelectedRange(days)
  }, [])

  const handleApply = useCallback(() => {
    const searchParams = buildSearchParams(filters, logCategory)
    navigate({ to: '/usage-logs', search: searchParams })
    onFilterChange?.(filters)
    setOpen(false)
  }, [filters, logCategory, navigate, onFilterChange, setOpen])

  const handleReset = useCallback(() => {
    const { start, end } = getDefaultTimeRange()
    const resetFilters = { startTime: start, endTime: end }

    setFilters(resetFilters)
    setSelectedRange(null)

    navigate({
      to: '/usage-logs',
      search: { startTime: start.getTime(), endTime: end.getTime() },
    })

    onFilterChange?.(resetFilters)
    setOpen(false)
  }, [navigate, onFilterChange, setOpen])

  // Render category-specific filters
  const renderCategoryFilters = () => {
    switch (logCategory) {
      case 'common': {
        const commonFilters = filters as CommonLogFilters
        return (
          <>
            <FilterInput
              id='model'
              label='Model Name'
              placeholder='e.g., gpt-4, claude-3'
              value={commonFilters.model || ''}
              onChange={(value) => handleChange('model', value)}
            />
            <FilterInput
              id='token'
              label='Token Name'
              placeholder='Filter by token name'
              value={commonFilters.token || ''}
              onChange={(value) => handleChange('token', value)}
            />
            <FilterInput
              id='group'
              label='Group'
              placeholder='Filter by group'
              value={commonFilters.group || ''}
              onChange={(value) => handleChange('group', value)}
            />
            {isAdmin && (
              <FilterInput
                id='username'
                label='Username'
                placeholder='Filter by username'
                value={commonFilters.username || ''}
                onChange={(value) => handleChange('username', value)}
              />
            )}
          </>
        )
      }
      case 'drawing': {
        const drawingFilters = filters as DrawingLogFilters
        return (
          <FilterInput
            id='mjId'
            label='Task ID'
            placeholder='Filter by Midjourney task ID'
            value={drawingFilters.mjId || ''}
            onChange={(value) => handleChange('mjId', value)}
          />
        )
      }
      case 'task': {
        const taskFilters = filters as TaskLogFilters
        return (
          <FilterInput
            id='taskId'
            label='Task ID'
            placeholder='Filter by task ID'
            value={taskFilters.taskId || ''}
            onChange={(value) => handleChange('taskId', value)}
          />
        )
      }
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            Filter {getLogCategoryLabel(logCategory)} Logs
          </DialogTitle>
          <DialogDescription>
            Set filters to narrow down your log search results.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[60vh] pr-4'>
          <div className='grid gap-4 py-4'>
            {/* Quick time range selection */}
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

            {/* Custom time range */}
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

            <SectionDivider label='Filters' />

            {renderCategoryFilters()}

            {/* Channel filter (admin only, all log types) */}
            {isAdmin && (
              <FilterInput
                id='channel'
                label='Channel ID'
                placeholder='Filter by channel ID'
                value={filters.channel || ''}
                onChange={(value) => handleChange('channel', value)}
              />
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
