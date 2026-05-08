import type { ChangeEvent } from 'react'
import * as z from 'zod'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
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
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

const invitationRebateSchema = z.object({
  InvitationRebateEnabled: z.boolean(),
  InvitationRebateRatioBps: z.coerce.number().int().min(0).max(10000),
  InvitationRebateMinQuota: z.coerce.number().int().min(0),
})

type InvitationRebateFormValues = z.infer<typeof invitationRebateSchema>

type InvitationRebateSettingsSectionProps = {
  defaultValues: InvitationRebateFormValues
}

export function InvitationRebateSettingsSection({
  defaultValues,
}: InvitationRebateSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const handleNumberChange =
    (onChange: (value: number | string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(
        event.target.value === '' ? '' : event.currentTarget.valueAsNumber
      )
    }

  const { form, handleSubmit, isDirty, isSubmitting } =
    useSettingsForm<InvitationRebateFormValues>({
      resolver: zodResolver(invitationRebateSchema) as Resolver<
        InvitationRebateFormValues,
        unknown,
        InvitationRebateFormValues
      >,
      defaultValues,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          await updateOption.mutateAsync({
            key,
            value: value as string | number | boolean,
          })
        }
      },
    })

  return (
    <SettingsSection
      title={t('Invitation Rebate')}
      description={t("Configure rebates from invited users' actual consumption")}
    >
      <FormNavigationGuard when={isDirty} />

      <Form {...form}>
        <form onSubmit={handleSubmit} className='space-y-6'>
          <FormDirtyIndicator isDirty={isDirty} />

          <FormField
            control={form.control}
            name='InvitationRebateEnabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    {t('Enable Invitation Rebate')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      "Grant inviter rewards after invited users consume quota. Rebates are based on actual consumption, not top-ups."
                    )}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className='grid gap-6 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='InvitationRebateRatioBps'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Rebate Ratio (bps)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      max={10000}
                      step={1}
                      value={field.value ?? ''}
                      onChange={handleNumberChange(field.onChange)}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Basis points of actual consumed quota to rebate to the inviter. 10000 bps = 100%; 1000 bps = 10%.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='InvitationRebateMinQuota'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Minimum Consumption Quota')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step={1}
                      value={field.value ?? ''}
                      onChange={handleNumberChange(field.onChange)}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Only grant rebates when actual consumed quota reaches this value.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type='submit'
            disabled={!isDirty || updateOption.isPending || isSubmitting}
          >
            {updateOption.isPending || isSubmitting
              ? t('Saving...')
              : t('Save Changes')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
