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

import { zodResolver } from '@hookform/resolvers/zod'
import { Activity01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

import {
  createChannelMonitor,
  runChannelMonitor,
  updateChannelMonitor,
} from '../api'
import { formatMonitorTime } from '../lib/format'
import {
  channelMonitorFormDefaults,
  channelMonitorFormSchema,
  type ChannelMonitorFormInput,
  type ChannelMonitorFormValues,
} from '../lib/schema'
import type {
  ChannelMonitor,
  ChannelMonitorPayload,
  ChannelMonitorRunResponse,
} from '../types'
import { MonitorHistoryBars, MonitorStatusBadge } from './monitor-status'

type ChannelMonitorSheetProps = {
  open: boolean
  monitor: ChannelMonitor | null
  onOpenChange: (open: boolean) => void
}

type SaveMutationInput = {
  values: ChannelMonitorFormValues
  runAfterSave: boolean
}

type SaveMutationResult = {
  monitor: ChannelMonitor
  test?: ChannelMonitorRunResponse
  runAfterSave: boolean
}

function buildFormDefaults(
  monitor: ChannelMonitor | null
): ChannelMonitorFormInput {
  if (!monitor) return channelMonitorFormDefaults
  return {
    name: monitor.name,
    api_url: monitor.api_url,
    api_key: '',
    test_model: monitor.test_model,
    interval_seconds: monitor.interval_seconds,
    timeout_seconds: monitor.timeout_seconds,
    enabled: monitor.enabled,
    visible: monitor.visible,
  }
}

export function ChannelMonitorSheet(props: ChannelMonitorSheetProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm<
    ChannelMonitorFormInput,
    unknown,
    ChannelMonitorFormValues
  >({
    resolver: zodResolver(channelMonitorFormSchema),
    defaultValues: buildFormDefaults(props.monitor),
  })

  useEffect(() => {
    if (props.open) form.reset(buildFormDefaults(props.monitor))
  }, [form, props.monitor, props.open])

  const saveMutation = useMutation<
    SaveMutationResult,
    Error,
    SaveMutationInput
  >({
    mutationFn: async (input) => {
      const payload: ChannelMonitorPayload = {
        ...input.values,
        name: input.values.name.trim(),
        api_url: input.values.api_url.trim(),
        api_key: input.values.api_key.trim(),
        test_model: input.values.test_model.trim(),
      }
      const saved = props.monitor
        ? await updateChannelMonitor(props.monitor.id, payload)
        : await createChannelMonitor(payload)
      if (!input.runAfterSave) {
        return { monitor: saved, runAfterSave: false }
      }
      const test = await runChannelMonitor(saved.id)
      return { monitor: test.monitor, test, runAfterSave: true }
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['channel-monitors'] })
      await queryClient.invalidateQueries({ queryKey: ['group-status'] })
      if (result.runAfterSave && result.test && !result.test.result.success) {
        toast.error(t('Configuration saved, but the availability test failed'))
        return
      }
      toast.success(
        result.runAfterSave
          ? t('Monitor saved and tested successfully')
          : t('Monitor saved successfully')
      )
      props.onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message || t('Operation failed'))
    },
  })

  const submit = (values: ChannelMonitorFormValues, runAfterSave: boolean) => {
    if (!props.monitor && values.api_key.trim() === '') {
      form.setError('api_key', { message: 'API key is required' })
      return
    }
    saveMutation.mutate({ values, runAfterSave })
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className='gap-0 sm:max-w-xl'>
        <SheetHeader className='border-b px-5 py-4'>
          <SheetTitle>
            {props.monitor ? t('Edit monitor') : t('Create monitor')}
          </SheetTitle>
          <SheetDescription>
            {t('Configure an OpenAI-compatible API availability test')}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            className='flex min-h-0 flex-1 flex-col'
            onSubmit={form.handleSubmit((values) => submit(values, false))}
          >
            <div className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4'>
              {props.monitor && (
                <div className='bg-muted/40 flex flex-col gap-3 rounded-lg border p-3'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium'>
                        {t('Latest test')}
                      </p>
                      <p className='text-muted-foreground mt-0.5 text-xs'>
                        {formatMonitorTime(props.monitor.last_checked_at)}
                        {props.monitor.latest_latency_ms != null &&
                          ` · ${props.monitor.latest_latency_ms} ms`}
                      </p>
                    </div>
                    <MonitorStatusBadge status={props.monitor.status} />
                  </div>
                  <MonitorHistoryBars
                    results={props.monitor.recent_results}
                    compact
                  />
                </div>
              )}

              <FieldGroup className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem className='sm:col-span-2'>
                      <FormLabel>{t('Monitor name')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='ChatGPT Pro' />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='api_url'
                  render={({ field }) => (
                    <FormItem className='sm:col-span-2'>
                      <FormLabel>{t('Group API')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode='url'
                          placeholder='https://api.openai.com/v1'
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Enter the API base URL or the full chat completions endpoint'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='api_key'
                  render={({ field }) => (
                    <FormItem className='sm:col-span-2'>
                      <FormLabel>{t('API Key')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='password'
                          autoComplete='new-password'
                          placeholder={
                            props.monitor
                              ? t('Leave blank to keep the current key')
                              : 'sk-...'
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t('The API key is encrypted before being stored')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='test_model'
                  render={({ field }) => (
                    <FormItem className='sm:col-span-2'>
                      <FormLabel>{t('Test model')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='gpt-4.1-mini' />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='interval_seconds'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Test interval')}</FormLabel>
                      <FormControl>
                        <InputGroup>
                          <InputGroupInput
                            type='number'
                            min={1}
                            max={86400}
                            step={1}
                            value={String(field.value ?? '')}
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                          />
                          <InputGroupAddon align='inline-end'>
                            <InputGroupText>{t('seconds')}</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                      </FormControl>
                      <FormDescription>
                        {t('Allowed range: 1 to 86400 seconds')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='timeout_seconds'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Request timeout')}</FormLabel>
                      <FormControl>
                        <InputGroup>
                          <InputGroupInput
                            type='number'
                            min={1}
                            max={120}
                            step={1}
                            value={String(field.value ?? '')}
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                          />
                          <InputGroupAddon align='inline-end'>
                            <InputGroupText>{t('seconds')}</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FieldGroup>

              <Separator />

              <FieldGroup className='gap-1'>
                <FormField
                  control={form.control}
                  name='enabled'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between gap-4 rounded-lg px-1 py-2'>
                      <div>
                        <FormLabel>{t('Enable scheduled tests')}</FormLabel>
                        <FormDescription>
                          {t('Send test requests at the configured interval')}
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
                <FormField
                  control={form.control}
                  name='visible'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between gap-4 rounded-lg px-1 py-2'>
                      <div>
                        <FormLabel>{t('Show to signed-in users')}</FormLabel>
                        <FormDescription>
                          {t('Display this group on the group status page')}
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
              </FieldGroup>
            </div>

            <SheetFooter className='flex-row justify-end border-t px-5 py-3'>
              <Button
                type='button'
                variant='outline'
                onClick={() => props.onOpenChange(false)}
                disabled={saveMutation.isPending}
              >
                {t('Cancel')}
              </Button>
              <Button type='submit' disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Spinner data-icon='inline-start' />
                ) : (
                  <HugeiconsIcon icon={Tick02Icon} data-icon='inline-start' />
                )}
                {t('Save')}
              </Button>
              <Button
                type='button'
                disabled={saveMutation.isPending}
                onClick={() =>
                  void form.handleSubmit((values) => submit(values, true))()
                }
              >
                {saveMutation.isPending ? (
                  <Spinner data-icon='inline-start' />
                ) : (
                  <HugeiconsIcon
                    icon={Activity01Icon}
                    data-icon='inline-start'
                  />
                )}
                {t('Save and test')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
