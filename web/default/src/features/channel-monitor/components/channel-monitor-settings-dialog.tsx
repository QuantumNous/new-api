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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { updateChannelMonitorSettings } from '../api'
import {
  createChannelMonitorSettingsSchema,
  MAX_AUTO_UPDATE_INTERVAL_MINUTES,
  MAX_AUTO_UPDATE_RETRY_COUNT,
  type ChannelMonitorSettingsFormValues,
} from '../lib/schema'
import type { ChannelMonitorSettings } from '../types'
import { ChannelMonitorSmartScheduleFields } from './channel-monitor-smart-schedule-fields'

export type ChannelMonitorSettingsSection = 'monitor' | 'schedule'

type ChannelMonitorSettingsDialogProps = {
  settings: ChannelMonitorSettings
  modelOptions: string[]
  initialSection: ChannelMonitorSettingsSection
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChannelMonitorSettingsDialog(
  props: ChannelMonitorSettingsDialogProps
) {
  const queryClient = useQueryClient()
  const form = useForm<ChannelMonitorSettingsFormValues>({
    resolver: zodResolver(
      createChannelMonitorSettingsSchema()
    ) as Resolver<ChannelMonitorSettingsFormValues>,
    defaultValues: {
      autoUpdateIntervalMinutes: props.settings.auto_update_interval_minutes,
      autoUpdateRetryCount: props.settings.auto_update_retry_count,
      emailNotificationEnabled: props.settings.email_notification_enabled,
      notificationEmail: props.settings.notification_email,
      smartScheduleEnabled: props.settings.smart_schedule_enabled,
      smartScheduleIntervalMinutes:
        props.settings.smart_schedule_interval_minutes,
      smartScheduleStrategy: props.settings.smart_schedule_strategy,
      smartScheduleStabilityEnabled:
        props.settings.smart_schedule_stability_enabled ?? false,
      smartScheduleApplyMode: props.settings.smart_schedule_apply_mode,
      smartSchedulePerformanceMinutes:
        props.settings.smart_schedule_performance_minutes,
      smartScheduleModel: props.settings.smart_schedule_model,
      smartScheduleMinSamples: props.settings.smart_schedule_min_samples,
      smartScheduleForceReset: false,
    },
  })
  const emailNotificationEnabled = useWatch({
    control: form.control,
    name: 'emailNotificationEnabled',
  })
  const mutation = useMutation({
    mutationFn: updateChannelMonitorSettings,
    onSuccess: (response) => {
      if (response.data.smart_schedule_force_reset_task_error) {
        toast.error(
          `设置已保存，但无法创建重算任务：${response.data.smart_schedule_force_reset_task_error}`
        )
      } else if (
        response.data.smart_schedule_force_reset_task_created === true
      ) {
        toast.success('设置已保存，强制重算任务已创建')
      } else if (
        response.data.smart_schedule_force_reset_task_created === false
      ) {
        toast.warning(
          '设置已保存，但已有智能调度任务正在运行，本次强制重算未排队'
        )
      } else {
        toast.success('渠道监控设置已保存')
      }
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      props.onOpenChange(false)
    },
  })
  const handleSubmit = form.handleSubmit((values) => {
    mutation.mutate({
      auto_update_interval_minutes: values.autoUpdateIntervalMinutes,
      auto_update_retry_count: values.autoUpdateRetryCount,
      email_notification_enabled: values.emailNotificationEnabled,
      notification_email: values.notificationEmail,
      smart_schedule_enabled: values.smartScheduleEnabled,
      smart_schedule_interval_minutes: values.smartScheduleIntervalMinutes,
      smart_schedule_strategy: values.smartScheduleStrategy,
      smart_schedule_stability_enabled: values.smartScheduleStabilityEnabled,
      smart_schedule_apply_mode: values.smartScheduleApplyMode,
      smart_schedule_performance_minutes:
        values.smartSchedulePerformanceMinutes,
      smart_schedule_model: values.smartScheduleModel,
      smart_schedule_min_samples: values.smartScheduleMinSamples,
      smart_schedule_force_reset: values.smartScheduleForceReset,
    })
  })

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[min(90dvh,54rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>渠道监控设置</DialogTitle>
          <DialogDescription>
            设置上游倍率更新、通知和智能调度规则
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className='flex flex-col gap-5' onSubmit={handleSubmit}>
            <Tabs defaultValue={props.initialSection} className='gap-5'>
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value='monitor'>倍率更新与通知</TabsTrigger>
                <TabsTrigger value='schedule'>智能调度</TabsTrigger>
              </TabsList>

              <TabsContent value='monitor' className='mt-0 flex flex-col gap-5'>
                <FormField
                  control={form.control}
                  name='autoUpdateIntervalMinutes'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>更新间隔</FormLabel>
                      <FormControl>
                        <InputGroup>
                          <InputGroupInput
                            type='number'
                            min={0}
                            max={MAX_AUTO_UPDATE_INTERVAL_MINUTES}
                            step={1}
                            inputMode='numeric'
                            value={field.value}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            name={field.name}
                            ref={field.ref}
                            aria-invalid={Boolean(
                              form.formState.errors.autoUpdateIntervalMinutes
                            )}
                          />
                          <InputGroupAddon align='inline-end'>
                            分钟
                          </InputGroupAddon>
                        </InputGroup>
                      </FormControl>
                      <FormDescription>
                        设置为 0 时关闭自动更新；保存后自动生效
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='autoUpdateRetryCount'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>失败重试次数</FormLabel>
                      <FormControl>
                        <InputGroup>
                          <InputGroupInput
                            type='number'
                            min={0}
                            max={MAX_AUTO_UPDATE_RETRY_COUNT}
                            step={1}
                            inputMode='numeric'
                            value={field.value}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            name={field.name}
                            ref={field.ref}
                            aria-invalid={Boolean(
                              form.formState.errors.autoUpdateRetryCount
                            )}
                          />
                          <InputGroupAddon align='inline-end'>
                            次
                          </InputGroupAddon>
                        </InputGroup>
                      </FormControl>
                      <FormDescription>
                        首次失败后最多再尝试的次数；设置为 0 时不重试
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='emailNotificationEnabled'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between gap-4'>
                      <div className='space-y-1'>
                        <FormLabel>邮件通知</FormLabel>
                        <FormDescription>
                          开启后，定时更新检测到渠道倍率变化、余额低于渠道预警值或更新失败时发送邮件
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label='开启渠道监控邮件通知'
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='notificationEmail'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>通知邮箱</FormLabel>
                      <FormControl>
                        <Input
                          type='email'
                          disabled={!emailNotificationEnabled}
                          autoComplete='email'
                          placeholder='name@example.com'
                          value={field.value}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          name={field.name}
                          ref={field.ref}
                          aria-invalid={Boolean(
                            form.formState.errors.notificationEmail
                          )}
                        />
                      </FormControl>
                      <FormDescription>
                        关闭通知后仍会保留邮箱地址；邮件发送使用系统 SMTP 设置
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value='schedule' className='mt-0'>
                <ChannelMonitorSmartScheduleFields
                  form={form}
                  modelOptions={props.modelOptions}
                />
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => props.onOpenChange(false)}
                disabled={mutation.isPending}
              >
                取消
              </Button>
              <Button type='submit' disabled={mutation.isPending}>
                {mutation.isPending && <Spinner data-icon='inline-start' />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
