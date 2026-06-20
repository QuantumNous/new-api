/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect } from 'react'
import { type Resolver, type UseFormReturn, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestampForInput, parseTimestampFromInput } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  channelFlowPoolFormSchema,
  defaultPoolFormValues,
  poolToFormValues,
  type ChannelFlowPoolFormValues,
} from '../lib'
import type { ChannelFlowPool } from '../types'

type PoolFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pool?: ChannelFlowPool | null
  submitting: boolean
  onSubmit: (values: ChannelFlowPoolFormValues) => void
}

const numberFields = [
  'max_inflight',
  'max_inflight_per_user',
  'max_queue_size',
  'max_queue_per_user',
  'queue_timeout_ms',
  'max_context_tokens',
  'max_context_chars',
  'max_processing_ms',
  'lease_ms',
  'renew_interval_ms',
] as const

type SelectOption<T extends string> = {
  value: T
  label: string
}

function getOptionLabel<T extends string>(
  options: SelectOption<T>[],
  value: T
) {
  return options.find((option) => option.value === value)?.label ?? value
}

export function PoolFormSheet(props: PoolFormSheetProps) {
  const { t } = useTranslation()
  const form = useForm<ChannelFlowPoolFormValues>({
    resolver: zodResolver(
      channelFlowPoolFormSchema
    ) as unknown as Resolver<ChannelFlowPoolFormValues>,
    defaultValues: defaultPoolFormValues,
  })
  const backend = form.watch('backend')
  const scheduleMode = form.watch('schedule_mode')
  const isEditMode = Boolean(props.pool?.id)
  const backendOptions: SelectOption<ChannelFlowPoolFormValues['backend']>[] = [
    { value: 'memory', label: t('Memory') },
    { value: 'redis', label: t('Redis (experimental)') },
  ]
  const onLimitOptions: SelectOption<ChannelFlowPoolFormValues['on_limit']>[] =
    [
      { value: 'queue', label: t('Queue') },
      { value: 'reject', label: t('Reject') },
      { value: 'fallback', label: t('Fallback') },
    ]
  const queuePolicyOptions: SelectOption<
    ChannelFlowPoolFormValues['queue_policy']
  >[] = [{ value: 'fifo', label: t('FIFO') }]
  const redisFailurePolicyOptions: SelectOption<
    ChannelFlowPoolFormValues['redis_failure_policy']
  >[] = [
    { value: 'fail_open', label: t('Fail open') },
    { value: 'fail_closed', label: t('Fail closed') },
    { value: 'local_memory', label: t('Local memory fallback') },
  ]
  const scheduleModeOptions: SelectOption<
    ChannelFlowPoolFormValues['schedule_mode']
  >[] = [
    { value: 'always', label: t('Always active') },
    { value: 'datetime_range', label: t('Date range') },
    { value: 'weekly', label: t('Weekly schedule') },
  ]
  const weekdayOptions = [
    { value: 0, label: t('Sun') },
    { value: 1, label: t('Mon') },
    { value: 2, label: t('Tue') },
    { value: 3, label: t('Wed') },
    { value: 4, label: t('Thu') },
    { value: 5, label: t('Fri') },
    { value: 6, label: t('Sat') },
  ]

  useEffect(() => {
    if (!props.open) return
    form.reset(poolToFormValues(props.pool))
  }, [form, props.open, props.pool])

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className='w-full sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? t('Edit Flow Pool') : t('Create Flow Pool')}
          </SheetTitle>
          <SheetDescription>
            {t(
              'Flow Pools cap total upstream concurrency and keep excess requests in a bounded queue.'
            )}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id='channel-flow-pool-form'
            className='min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-2'
            onSubmit={form.handleSubmit(props.onSubmit)}
          >
            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <FormItem className='bg-muted/40 flex items-center justify-between gap-4 rounded-lg border p-3'>
                  <div className='space-y-1'>
                    <FormLabel>{t('Enabled')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Disabled pools keep their bindings but do not gate traffic.'
                      )}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Pool name')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Claude 96-card cluster')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='backend'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Backend')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue>
                            {getOptionLabel(backendOptions, field.value)}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {backendOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      className='min-h-20'
                      placeholder={t(
                        'Shared upstream pool for channels that hit the same physical capacity.'
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='space-y-3'>
              <h3 className='text-sm font-medium'>{t('Effective schedule')}</h3>
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='schedule_mode'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Schedule mode')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className='w-full'>
                            <SelectValue>
                              {getOptionLabel(scheduleModeOptions, field.value)}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {scheduleModeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {t(
                          'Outside the active window, traffic bypasses this Flow Pool.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='schedule_timezone'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Timezone')}</FormLabel>
                      <FormControl>
                        <Input placeholder='Asia/Shanghai' {...field} />
                      </FormControl>
                      <FormDescription>
                        {t('Used by weekly schedules')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {scheduleMode === 'datetime_range' && (
                <div className='grid gap-4 sm:grid-cols-2'>
                  <DateTimeField
                    form={form}
                    name='effective_start_time'
                    label={t('Start time')}
                  />
                  <DateTimeField
                    form={form}
                    name='effective_end_time'
                    label={t('End time')}
                  />
                </div>
              )}

              {scheduleMode === 'weekly' && (
                <div className='bg-muted/20 space-y-3 rounded-lg border p-3'>
                  <FormField
                    control={form.control}
                    name='schedule_weekdays'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Active weekdays')}</FormLabel>
                        <div className='flex flex-wrap gap-2'>
                          {weekdayOptions.map((option) => {
                            const checked = field.value.includes(option.value)
                            return (
                              <label
                                key={option.value}
                                className='bg-background flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium'
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(nextChecked) => {
                                    if (nextChecked === true) {
                                      field.onChange([
                                        ...field.value,
                                        option.value,
                                      ])
                                      return
                                    }
                                    field.onChange(
                                      field.value.filter(
                                        (weekday) => weekday !== option.value
                                      )
                                    )
                                  }}
                                />
                                {option.label}
                              </label>
                            )
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <TimeField
                      form={form}
                      name='schedule_start_time'
                      label={t('Start time')}
                    />
                    <TimeField
                      form={form}
                      name='schedule_end_time'
                      label={t('End time')}
                    />
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'End time earlier than start time means the window crosses midnight.'
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className='space-y-3'>
              <h3 className='text-sm font-medium'>
                {t('Concurrency and queue')}
              </h3>
              <div className='grid gap-4 sm:grid-cols-3'>
                <NumberField
                  form={form}
                  name='max_inflight'
                  label={t('Max inflight')}
                  description={t('0 means unlimited')}
                />
                <NumberField
                  form={form}
                  name='max_inflight_per_user'
                  label={t('Per-user inflight cap')}
                  description={t('0 means unlimited')}
                />
                <NumberField
                  form={form}
                  name='max_queue_size'
                  label={t('Max queue size')}
                  description={t('Queue length hard cap')}
                />
                <NumberField
                  form={form}
                  name='max_queue_per_user'
                  label={t('Per-user queue cap')}
                  description={t('0 means unlimited')}
                />
                <NumberField
                  form={form}
                  name='queue_timeout_ms'
                  label={t('Queue timeout (ms)')}
                  description={t('Requests time out after waiting this long')}
                />
                <FormField
                  control={form.control}
                  name='on_limit'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('When full')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className='w-full'>
                            <SelectValue>
                              {getOptionLabel(onLimitOptions, field.value)}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {onLimitOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='queue_policy'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Queue policy')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className='w-full'>
                            <SelectValue>
                              {getOptionLabel(queuePolicyOptions, field.value)}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {queuePolicyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className='space-y-3'>
              <h3 className='text-sm font-medium'>{t('Context guards')}</h3>
              <div className='grid gap-4 sm:grid-cols-2'>
                <NumberField
                  form={form}
                  name='max_context_tokens'
                  label={t('Max context tokens')}
                  description={t('0 means unlimited')}
                />
                <NumberField
                  form={form}
                  name='max_context_chars'
                  label={t('Max context chars')}
                  description={t('0 means unlimited')}
                />
              </div>
            </div>

            <div className='space-y-3'>
              <h3 className='text-sm font-medium'>{t('Lease safety')}</h3>
              <div className='grid gap-4 sm:grid-cols-3'>
                <NumberField
                  form={form}
                  name='max_processing_ms'
                  label={t('Max processing (ms)')}
                  description={t('0 disables stale cleanup')}
                />
                <NumberField
                  form={form}
                  name='lease_ms'
                  label={t('Lease (ms)')}
                  description={t('Redis lease budget')}
                />
                <NumberField
                  form={form}
                  name='renew_interval_ms'
                  label={t('Renew interval (ms)')}
                  description={t('Lease heartbeat interval')}
                />
              </div>
            </div>

            {backend === 'redis' && (
              <FormField
                control={form.control}
                name='redis_failure_policy'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Redis failure policy')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue>
                            {getOptionLabel(
                              redisFailurePolicyOptions,
                              field.value
                            )}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {redisFailurePolicyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t(
                        'Redis backend is still experimental until the Phase 0 spike is accepted.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>

        <SheetFooter className='border-t'>
          <Button
            form='channel-flow-pool-form'
            type='submit'
            disabled={props.submitting}
          >
            {props.submitting && <Loader2 className='size-4 animate-spin' />}
            {isEditMode ? t('Save changes') : t('Create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

type NumberFieldProps = {
  form: UseFormReturn<ChannelFlowPoolFormValues>
  name: (typeof numberFields)[number]
  label: string
  description?: string
}

type DateTimeFieldProps = {
  form: UseFormReturn<ChannelFlowPoolFormValues>
  name: 'effective_start_time' | 'effective_end_time'
  label: string
}

function DateTimeField(props: DateTimeFieldProps) {
  return (
    <FormField
      control={props.form.control}
      name={props.name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{props.label}</FormLabel>
          <FormControl>
            <Input
              type='datetime-local'
              value={
                field.value > 0 ? formatTimestampForInput(field.value) : ''
              }
              onChange={(event) =>
                field.onChange(
                  Math.max(0, parseTimestampFromInput(event.target.value))
                )
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type TimeFieldProps = {
  form: UseFormReturn<ChannelFlowPoolFormValues>
  name: 'schedule_start_time' | 'schedule_end_time'
  label: string
}

function TimeField(props: TimeFieldProps) {
  return (
    <FormField
      control={props.form.control}
      name={props.name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{props.label}</FormLabel>
          <FormControl>
            <Input type='time' {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function NumberField(props: NumberFieldProps) {
  return (
    <FormField
      control={props.form.control}
      name={props.name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{props.label}</FormLabel>
          <FormControl>
            <Input
              type='number'
              min={0}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(Number(event.target.value))}
            />
          </FormControl>
          {props.description && (
            <FormDescription>{props.description}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
