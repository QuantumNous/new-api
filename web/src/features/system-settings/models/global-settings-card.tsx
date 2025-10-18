import { useEffect } from 'react'
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
import { SettingsAccordion } from '../components/settings-accordion'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z.object({
  'global.pass_through_request_enabled': z.boolean(),
  'general_setting.ping_interval_enabled': z.boolean(),
  'general_setting.ping_interval_seconds': z.coerce.number().min(1),
})

type GlobalModelSettingsFormValues = z.infer<typeof schema>

type GlobalSettingsCardProps = {
  defaultValues: GlobalModelSettingsFormValues
}

export function GlobalSettingsCard({ defaultValues }: GlobalSettingsCardProps) {
  const updateOption = useUpdateOption()

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const pingEnabled = form.watch('general_setting.ping_interval_enabled')

  const onSubmit = async (values: GlobalModelSettingsFormValues) => {
    const updates: Array<{
      key: keyof GlobalModelSettingsFormValues
      value: any
    }> = []

    ;(
      Object.keys(values) as Array<keyof GlobalModelSettingsFormValues>
    ).forEach((key) => {
      if (values[key] !== defaultValues[key]) {
        updates.push({ key, value: values[key] })
      }
    })

    for (const update of updates) {
      await updateOption.mutateAsync({
        key: update.key,
        value: update.value,
      })
    }
  }

  return (
    <SettingsAccordion
      value='global-settings'
      title='Global Model Configuration'
      description='Control passthrough behavior and connection keep-alive settings'
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='global.pass_through_request_enabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    Enable Request Passthrough
                  </FormLabel>
                  <FormDescription>
                    Forward requests directly to upstream providers without any
                    post-processing.
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
            name='general_setting.ping_interval_enabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>Keep-alive Ping</FormLabel>
                  <FormDescription>
                    Periodically send ping frames to keep streaming connections
                    active.
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
            name='general_setting.ping_interval_seconds'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ping Interval (seconds)</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    disabled={!pingEnabled}
                    className='w-24'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Recommended to keep this high to avoid upstream throttling.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
