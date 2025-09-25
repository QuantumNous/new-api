import { useState, useCallback } from 'react'
import { z } from 'zod'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon, Search, RotateCcw } from 'lucide-react'
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

const searchSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
    username: z.string().optional(),
    timeGranularity: z.enum(['hour', 'day', 'week']),
    modelFilter: z.string().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  })

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
  const [loading, setLoading] = useState(false)
  const user = getStoredUser()
  const isAdmin = user && (user as any).role >= 10

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
          <DialogTitle>Advanced Dashboard Search</DialogTitle>
          <DialogDescription>
            Search and filter your usage data with advanced criteria
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
                Last 24h
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => handleQuickTimeRange(7)}
              >
                Last 7 days
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => handleQuickTimeRange(30)}
              >
                Last 30 days
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => handleQuickTimeRange(90)}
              >
                Last 90 days
              </Button>
            </div>

            {/* Date Range */}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='startDate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
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
                              <span>Pick a date</span>
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
                    <FormLabel>End Date</FormLabel>
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
                              <span>Pick a date</span>
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
                  <FormLabel>Time Granularity</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select time granularity' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='hour'>Hourly</SelectItem>
                      <SelectItem value='day'>Daily</SelectItem>
                      <SelectItem value='week'>Weekly</SelectItem>
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
                    <FormLabel>Filter by Username (Admin)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Enter username to filter (optional)'
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
                  <FormLabel>Model Filter</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Filter by model name (optional)'
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
                Reset
              </Button>
              <div className='space-x-2'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type='submit' disabled={loading}>
                  <Search className='mr-2 h-4 w-4' />
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
