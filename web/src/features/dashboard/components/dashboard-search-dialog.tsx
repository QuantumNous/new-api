import { useState, useCallback } from 'react'
import { z } from 'zod'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon, Search, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getStoredUser } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DashboardFilters } from '../hooks/use-dashboard-data'

interface DashboardSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSearch: (filters: DashboardFilters) => void
  currentFilters: DashboardFilters
}

export function DashboardSearchDialog({
  open,
  onOpenChange,
  onSearch,
  currentFilters,
}: DashboardSearchDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const user = getStoredUser()
  const isAdmin = user && (user as any).role >= 10

  const searchSchema = z
    .object({
      startDate: z.date(),
      endDate: z.date(),
      username: z.string().optional(),
      timeGranularity: z.enum(['hour', 'day', 'week']),
      modelFilter: z.string().optional(),
    })
    .refine((data) => data.endDate >= data.startDate, {
      message: t('dashboard.search.end_date_after_start'),
      path: ['endDate'],
    })

  const form = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      startDate: new Date(currentFilters.startTimestamp * 1000),
      endDate: new Date(currentFilters.endTimestamp * 1000),
      username: currentFilters.username || '',
      timeGranularity: currentFilters.defaultTime || 'day',
      modelFilter: '',
    },
  })

  const handleSearch = useCallback(
    async (values: z.infer<typeof searchSchema>) => {
      setLoading(true)
      try {
        const filters: DashboardFilters = {
          startTimestamp: Math.floor(values.startDate.getTime() / 1000),
          endTimestamp: Math.floor(values.endDate.getTime() / 1000),
          defaultTime: values.timeGranularity,
          username: values.username || undefined,
        }

        onSearch(filters)
        onOpenChange(false)
      } finally {
        setLoading(false)
      }
    },
    [onSearch, onOpenChange]
  )

  const handleReset = useCallback(() => {
    form.reset({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      endDate: new Date(),
      username: '',
      timeGranularity: 'day',
      modelFilter: '',
    })
  }, [form])

  const handleQuickTimeRange = useCallback(
    (days: number) => {
      const endDate = new Date()
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      form.setValue('startDate', startDate)
      form.setValue('endDate', endDate)
    },
    [form]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('dashboard.search.title')}</DialogTitle>
          <DialogDescription>
            {t('dashboard.search.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSearch)}
            className='space-y-6'
          >
            {/* Quick Time Range Buttons */}
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => handleQuickTimeRange(1)}
              >
                {t('dashboard.search.last_24h')}
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => handleQuickTimeRange(7)}
              >
                {t('dashboard.search.last_7_days')}
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => handleQuickTimeRange(30)}
              >
                {t('dashboard.search.last_30_days')}
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => handleQuickTimeRange(90)}
              >
                {t('dashboard.search.last_90_days')}
              </Button>
            </div>

            {/* Date Range */}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='startDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('dashboard.search.start_date')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant='outline'
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>{t('dashboard.search.pick_date')}</span>
                            )}
                            <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className='w-auto p-0' align='start'>
                        <Calendar
                          mode='single'
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date('1900-01-01')
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='endDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('dashboard.search.end_date')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant='outline'
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>{t('dashboard.search.pick_date')}</span>
                            )}
                            <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className='w-auto p-0' align='start'>
                        <Calendar
                          mode='single'
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date('1900-01-01')
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Time Granularity */}
            <FormField
              control={form.control}
              name='timeGranularity'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('dashboard.search.time_granularity')}
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            'dashboard.search.select_time_granularity'
                          )}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='hour'>
                        {t('dashboard.search.hourly')}
                      </SelectItem>
                      <SelectItem value='day'>
                        {t('dashboard.search.daily')}
                      </SelectItem>
                      <SelectItem value='week'>
                        {t('dashboard.search.weekly')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Admin-only Username Filter */}
            {isAdmin && (
              <FormField
                control={form.control}
                name='username'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('dashboard.search.filter_by_username')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('dashboard.search.username_placeholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Model Filter */}
            <FormField
              control={form.control}
              name='modelFilter'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dashboard.search.model_filter')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t(
                        'dashboard.search.model_filter_placeholder'
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className='flex justify-between space-x-2'>
              <Button
                type='button'
                variant='outline'
                onClick={handleReset}
                disabled={loading}
              >
                <RotateCcw className='mr-2 h-4 w-4' />
                {t('dashboard.search.reset')}
              </Button>
              <Button type='submit' disabled={loading}>
                <Search className='mr-2 h-4 w-4' />
                {loading
                  ? t('dashboard.search.searching')
                  : t('dashboard.search.search')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
