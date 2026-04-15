import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, getRouteApi } from '@tanstack/react-router'
import { Search, RotateCcw, Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getNormalizedDateRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useIsAdmin } from '@/hooks/use-admin'
import { Button } from '@/components/ui/button'
import { ComboboxInput } from '@/components/ui/combobox-input'
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
import { getApiKeys } from '@/features/keys/api'
import { TIME_RANGE_PRESETS } from '../../constants'
import { buildSearchParams, getLogCategoryLabel } from '../../lib/filter'
import { getDefaultTimeRange } from '../../lib/utils'
import type {
  LogCategory,
  LogFilters,
  CommonLogFilters,
  DrawingLogFilters,
  TaskLogFilters,
} from '../../types'
import { FilterInput, SectionDivider } from './filter-components'

const route = getRouteApi('/_authenticated/usage-logs/$section')

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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const searchParams = route.useSearch()
  const isAdmin = useIsAdmin()
  const [internalOpen, setInternalOpen] = useState(false)

  const open = controlledOpen ?? internalOpen
  const setOpen = controlledOnOpenChange ?? setInternalOpen

  const [filters, setFilters] = useState<LogFilters>(() => {
    const { start, end } = getDefaultTimeRange()
    return { startTime: start, endTime: end }
  })
  const [selectedRange, setSelectedRange] = useState<number | null>(null)

  const { data: tokensData } = useQuery({
    queryKey: ['api-keys', 'filter', open, logCategory],
    queryFn: () => getApiKeys({ p: 1, size: 200 }),
    enabled: open && logCategory === 'common',
  })

  const tokenNameOptions = useMemo(() => {
    const items = tokensData?.data?.items ?? []
    const seen = new Set<string>()
    return items
      .filter((item) => {
        if (seen.has(item.name)) return false
        seen.add(item.name)
        return true
      })
      .map((item) => ({ value: item.name, label: item.name }))
  }, [tokensData?.data?.items])

  // Sync filters from URL
  useEffect(() => {
    const urlFilters: Partial<LogFilters> = {}

    if (searchParams.startTime)
      urlFilters.startTime = new Date(searchParams.startTime)
    if (searchParams.endTime)
      urlFilters.endTime = new Date(searchParams.endTime)
    if (searchParams.channel) urlFilters.channel = String(searchParams.channel)

    if (logCategory === 'common') {
      if (searchParams.model)
        (urlFilters as CommonLogFilters).model = searchParams.model
      if (searchParams.token)
        (urlFilters as CommonLogFilters).token = searchParams.token
      if (searchParams.group)
        (urlFilters as CommonLogFilters).group = searchParams.group
      if (searchParams.username)
        (urlFilters as CommonLogFilters).username = searchParams.username
      if (searchParams.requestId)
        (urlFilters as CommonLogFilters).requestId = searchParams.requestId
    } else if (logCategory === 'drawing') {
      if (searchParams.filter)
        (urlFilters as DrawingLogFilters).mjId = searchParams.filter
    } else if (logCategory === 'task') {
      if (searchParams.filter)
        (urlFilters as TaskLogFilters).taskId = searchParams.filter
    }

    if (Object.keys(urlFilters).length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilters((prev: LogFilters) => ({ ...prev, ...urlFilters }))
      setSelectedRange(null)
    }
  }, [
    logCategory,
    searchParams.startTime,
    searchParams.endTime,
    searchParams.channel,
    searchParams.model,
    searchParams.token,
    searchParams.group,
    searchParams.username,
    searchParams.requestId,
    searchParams.filter,
  ])

  const handleChange = useCallback(
    (field: string, value: Date | string | undefined) => {
      setFilters((prev: LogFilters) => ({ ...prev, [field]: value }))
      if (field === 'startTime' || field === 'endTime') {
        setSelectedRange(null)
      }
    },
    []
  )

  const handleQuickRange = useCallback((days: number) => {
    const { start, end } = getNormalizedDateRange(days)
    setFilters((prev: LogFilters) => ({
      ...prev,
      startTime: start,
      endTime: end,
    }))
    setSelectedRange(days)
  }, [])

  const navigateWithFilters = useCallback(
    (searchUpdate: Record<string, unknown>) => {
      navigate({
        to: '/usage-logs/$section',
        params: { section: logCategory },
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          ...searchUpdate,
        }),
      })
    },
    [navigate, logCategory]
  )

  const handleApply = useCallback(() => {
    const filterParams = buildSearchParams(filters, logCategory)
    navigateWithFilters(filterParams)
    onFilterChange?.(filters)
    setOpen(false)
  }, [filters, logCategory, navigateWithFilters, onFilterChange, setOpen])

  const handleReset = useCallback(() => {
    const { start, end } = getDefaultTimeRange()
    const resetFilters: LogFilters = { startTime: start, endTime: end }

    setFilters(resetFilters)
    setSelectedRange(null)

    navigate({
      to: '/usage-logs/$section',
      params: { section: logCategory },
      search: {
        page: 1,
        startTime: start.getTime(),
        endTime: end.getTime(),
      },
    })

    onFilterChange?.(resetFilters)
    setOpen(false)
  }, [navigate, logCategory, onFilterChange, setOpen])

  // Render category-specific filters
  const renderCategoryFilters = () => {
    switch (logCategory) {
      case 'common': {
        const commonFilters = filters as CommonLogFilters
        return (
          <>
            <FilterInput
              id='model'
              label={t('Model Name')}
              placeholder={t('e.g., gpt-4, claude-3')}
              value={commonFilters.model || ''}
              onChange={(value) => handleChange('model', value)}
            />
            <div className='grid gap-2'>
              <Label htmlFor='token'>{t('Token Name')}</Label>
              <ComboboxInput
                id='token'
                options={tokenNameOptions}
                value={commonFilters.token || ''}
                onValueChange={(v) => handleChange('token', v)}
                placeholder={t('Filter by token name')}
                emptyText={t('No token found.')}
              />
            </div>
            <FilterInput
              id='group'
              label={t('Group')}
              placeholder={t('Filter by group')}
              value={commonFilters.group || ''}
              onChange={(value) => handleChange('group', value)}
            />
            {isAdmin && (
              <FilterInput
                id='username'
                label={t('Username')}
                placeholder={t('Filter by username')}
                value={commonFilters.username || ''}
                onChange={(value) => handleChange('username', value)}
              />
            )}
            <FilterInput
              id='requestId'
              label={t('Request ID')}
              placeholder={t('Filter by request ID')}
              value={commonFilters.requestId || ''}
              onChange={(value) => handleChange('requestId', value)}
            />
          </>
        )
      }
      case 'drawing': {
        const drawingFilters = filters as DrawingLogFilters
        return (
          <FilterInput
            id='mjId'
            label={t('Task ID')}
            placeholder={t('Filter by Midjourney task ID')}
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
            label={t('Task ID')}
            placeholder={t('Filter by task ID')}
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
            {t('Filter')} {t(getLogCategoryLabel(logCategory))} {t('Logs')}
          </DialogTitle>
          <DialogDescription>
            {t('Set filters to narrow down your log search results.')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[60vh] pr-4'>
          <div className='grid gap-4 py-4'>
            {/* Quick time range selection */}
            <div className='grid gap-2'>
              <Label className='flex items-center gap-2'>
                <Calendar className='h-4 w-4' />
                {t('Quick Range')}
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
                    {t(range.label)}
                  </Button>
                ))}
              </div>
            </div>

            <SectionDivider label={t('Custom Time Range')} />

            {/* Custom time range */}
            <div className='grid gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='start_time'>{t('Start Time')}</Label>
                <DateTimePicker
                  value={filters.startTime}
                  onChange={(date) =>
                    handleChange('startTime', date || undefined)
                  }
                  placeholder={t('Select start time')}
                />
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='end_time'>{t('End Time')}</Label>
                <DateTimePicker
                  value={filters.endTime}
                  onChange={(date) =>
                    handleChange('endTime', date || undefined)
                  }
                  placeholder={t('Select end time')}
                />
              </div>
            </div>

            <SectionDivider label={t('Filters')} />

            {renderCategoryFilters()}

            {/* Channel filter (admin only, all log types) */}
            {isAdmin && (
              <FilterInput
                id='channel'
                label={t('Channel ID')}
                placeholder={t('Filter by channel ID')}
                value={filters.channel || ''}
                onChange={(value) => handleChange('channel', value)}
              />
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleReset} variant='outline' type='button'>
            <RotateCcw className='mr-2 h-4 w-4' />
            {t('Reset')}
          </Button>
          <Button onClick={handleApply} type='submit'>
            <Search className='mr-2 h-4 w-4' />
            {t('Apply Filters')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
