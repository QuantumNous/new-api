import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SettingsAccordion } from '../components/settings-accordion'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const numericString = z.string().refine((value) => {
  const trimmed = value.trim()
  if (!trimmed) return true
  return !Number.isNaN(Number(trimmed)) && Number(trimmed) >= 0
}, 'Enter a non-negative number or leave empty')

const monitoringSchema = z.object({
  ChannelDisableThreshold: numericString,
  QuotaRemindThreshold: numericString,
  AutomaticDisableChannelEnabled: z.boolean(),
  AutomaticEnableChannelEnabled: z.boolean(),
  AutomaticDisableKeywords: z.string(),
  'monitor_setting.auto_test_channel_enabled': z.boolean(),
  'monitor_setting.auto_test_channel_minutes': z.coerce
    .number()
    .int()
    .min(1, 'Interval must be at least 1 minute'),
})

type MonitoringFormValues = z.infer<typeof monitoringSchema>

type MonitoringSettingsSectionProps = {
  defaultValues: MonitoringFormValues
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, '\n')
}

export function MonitoringSettingsSection({
  defaultValues,
}: MonitoringSettingsSectionProps) {
  const updateOption = useUpdateOption()

  const form = useForm({
    resolver: zodResolver(monitoringSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async (values: MonitoringFormValues) => {
    const updates: Array<{ key: string; value: string | boolean | number }> = []

    const channelThreshold = values.ChannelDisableThreshold.trim()
    const initialChannelThreshold = defaultValues.ChannelDisableThreshold.trim()
    if (channelThreshold !== initialChannelThreshold) {
      updates.push({
        key: 'ChannelDisableThreshold',
        value: channelThreshold,
      })
    }

    const quotaThreshold = values.QuotaRemindThreshold.trim()
    const initialQuotaThreshold = defaultValues.QuotaRemindThreshold.trim()
    if (quotaThreshold !== initialQuotaThreshold) {
      updates.push({
        key: 'QuotaRemindThreshold',
        value: quotaThreshold,
      })
    }

    if (
      values.AutomaticDisableChannelEnabled !==
      defaultValues.AutomaticDisableChannelEnabled
    ) {
      updates.push({
        key: 'AutomaticDisableChannelEnabled',
        value: values.AutomaticDisableChannelEnabled,
      })
    }

    if (
      values.AutomaticEnableChannelEnabled !==
      defaultValues.AutomaticEnableChannelEnabled
    ) {
      updates.push({
        key: 'AutomaticEnableChannelEnabled',
        value: values.AutomaticEnableChannelEnabled,
      })
    }

    const keywords = normalizeLineEndings(values.AutomaticDisableKeywords)
    const initialKeywords = normalizeLineEndings(
      defaultValues.AutomaticDisableKeywords
    )
    if (keywords !== initialKeywords) {
      updates.push({
        key: 'AutomaticDisableKeywords',
        value: values.AutomaticDisableKeywords,
      })
    }

    if (
      values['monitor_setting.auto_test_channel_enabled'] !==
      defaultValues['monitor_setting.auto_test_channel_enabled']
    ) {
      updates.push({
        key: 'monitor_setting.auto_test_channel_enabled',
        value: values['monitor_setting.auto_test_channel_enabled'],
      })
    }

    if (
      values['monitor_setting.auto_test_channel_minutes'] !==
      defaultValues['monitor_setting.auto_test_channel_minutes']
    ) {
      updates.push({
        key: 'monitor_setting.auto_test_channel_minutes',
        value: values['monitor_setting.auto_test_channel_minutes'],
      })
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsAccordion
      value='monitoring-settings'
      title='Monitoring & Alerts'
      description='Automatically test channels and notify users when limits are hit'
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='monitor_setting.auto_test_channel_enabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Scheduled channel tests
                    </FormLabel>
                    <FormDescription>
                      Automatically probe all channels in the background
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
              name='monitor_setting.auto_test_channel_minutes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test interval (minutes)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      step={1}
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(event.target.valueAsNumber)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    How frequently the system tests all channels
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='ChannelDisableThreshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Disable threshold (seconds)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step={1}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    Automatically disable channels exceeding this response time
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='QuotaRemindThreshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quota reminder (tokens)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step={1}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    Send email alerts when a user falls below this quota
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='AutomaticDisableChannelEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Disable on failure
                    </FormLabel>
                    <FormDescription>
                      Automatically disable channels when tests fail
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
              name='AutomaticEnableChannelEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Re-enable on success
                    </FormLabel>
                    <FormDescription>
                      Bring channels back online after successful checks
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
          </div>

          <FormField
            control={form.control}
            name='AutomaticDisableKeywords'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Failure keywords</FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    placeholder='one keyword per line'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  If an upstream error contains any of these keywords (case
                  insensitive), the channel will be disabled automatically.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? 'Saving...' : 'Save monitoring rules'}
          </Button>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
