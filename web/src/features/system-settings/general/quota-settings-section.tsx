import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import { SettingsAccordion } from '../components/settings-accordion'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const quotaSchema = z.object({
  QuotaForNewUser: z.coerce.number().min(0),
  PreConsumedQuota: z.coerce.number().min(0),
  QuotaForInviter: z.coerce.number().min(0),
  QuotaForInvitee: z.coerce.number().min(0),
  TopUpLink: z.string().url().optional().or(z.literal('')),
  'general_setting.docs_link': z.string().url().optional().or(z.literal('')),
  'quota_setting.enable_free_model_pre_consume': z.boolean(),
})

const OPTION_KEYS = [
  'QuotaForNewUser',
  'PreConsumedQuota',
  'QuotaForInviter',
  'QuotaForInvitee',
  'TopUpLink',
  'general_setting.docs_link',
  'quota_setting.enable_free_model_pre_consume',
] as const

type OptionKey = (typeof OPTION_KEYS)[number]

type QuotaFormValues = z.infer<typeof quotaSchema>

type QuotaSettingsSectionProps = {
  defaultValues: QuotaFormValues
}

export function QuotaSettingsSection({
  defaultValues,
}: QuotaSettingsSectionProps) {
  const updateOption = useUpdateOption()

  const form = useForm({
    resolver: zodResolver(quotaSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const onSubmit = async () => {
    const baseline =
      (form.formState.defaultValues as QuotaFormValues | undefined) ??
      defaultValues

    const updates = OPTION_KEYS.reduce<
      Array<[OptionKey, QuotaFormValues[OptionKey]]>
    >((acc, key) => {
      const currentValue = form.getValues(key as OptionKey)
      if (typeof currentValue === 'undefined') {
        return acc
      }

      const defaultValue = baseline[key]

      if (currentValue !== defaultValue) {
        acc.push([key, currentValue as QuotaFormValues[OptionKey]])
      }

      return acc
    }, [])

    if (updates.length === 0) {
      toast.info('No changes to save')
      return
    }

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({
        key,
        value: value as string | number | boolean,
      })
    }

    const nextDefaults = { ...baseline } as QuotaFormValues
    updates.forEach(([key, value]) => {
      ;(nextDefaults as Record<OptionKey, QuotaFormValues[OptionKey]>)[key] =
        value
    })

    form.reset(nextDefaults, {
      keepDirty: false,
      keepDirtyValues: false,
      keepErrors: true,
    })
  }

  return (
    <SettingsAccordion
      value='quota-settings'
      title='Quota Settings'
      description='Configure user quota allocation and rewards'
    >
      <FormNavigationGuard when={form.formState.isDirty} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormDirtyIndicator isDirty={form.formState.isDirty} />
          <FormField
            control={form.control}
            name='QuotaForNewUser'
            render={({ field }) => (
              <FormItem>
                <FormLabel>New User Quota</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    value={field.value as number}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  Initial quota given to new users
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='PreConsumedQuota'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pre-Consumed Quota</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    value={field.value as number}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  Quota consumed before charging users
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='QuotaForInviter'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inviter Reward</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    value={field.value as number}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  Quota given to users who invite others
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='QuotaForInvitee'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Invitee Reward</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    value={field.value as number}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>Quota given to invited users</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='quota_setting.enable_free_model_pre_consume'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    Pre-Consume for Free Models
                  </FormLabel>
                  <FormDescription>
                    When enabled, zero-cost models also pre-consume quota before
                    final settlement.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='TopUpLink'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Top-Up Link</FormLabel>
                <FormControl>
                  <Input placeholder='https://example.com/topup' {...field} />
                </FormControl>
                <FormDescription>
                  External link for users to purchase quota
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='general_setting.docs_link'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Documentation Link</FormLabel>
                <FormControl>
                  <Input placeholder='https://docs.example.com' {...field} />
                </FormControl>
                <FormDescription>
                  Link to your documentation site
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Form>
    </SettingsAccordion>
  )
}
