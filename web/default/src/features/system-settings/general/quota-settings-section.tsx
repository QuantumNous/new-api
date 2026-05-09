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

const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-8

const createQuotaSchema = (t: (key: string) => string) =>
  z.object({
    QuotaForNewUser: z.coerce.number().min(0),
    PreConsumedQuota: z.coerce.number().min(0),
    QuotaForInviter: z.coerce.number().min(0),
    QuotaForInvitee: z.coerce.number().min(0),
    InvitationRebateEnabled: z.boolean(),
    InvitationRebateRatioPercent: z.coerce
      .number()
      .min(0)
      .max(100)
      .refine(hasAtMostTwoDecimals, {
        message: t('Use at most two decimal places'),
      }),
    InvitationRebateMinQuota: z.coerce.number().int().min(0),
    TopUpLink: z.string(),
    general_setting: z.object({
      docs_link: z.string(),
    }),
    quota_setting: z.object({
      enable_free_model_pre_consume: z.boolean(),
    }),
  })

type QuotaFormValues = z.infer<ReturnType<typeof createQuotaSchema>>

type QuotaSettingsSectionProps = {
  defaultValues: QuotaFormValues
}

export function QuotaSettingsSection({
  defaultValues,
}: QuotaSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const quotaSchema = createQuotaSchema(t)
  const handleNumberChange =
    (onChange: (value: number | string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(
        event.target.value === '' ? '' : event.currentTarget.valueAsNumber
      )
    }

  const { form, handleSubmit, isDirty, isSubmitting } =
    useSettingsForm<QuotaFormValues>({
      resolver: zodResolver(quotaSchema) as Resolver<
        QuotaFormValues,
        unknown,
        QuotaFormValues
      >,
      defaultValues,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          if (key === 'InvitationRebateRatioPercent') {
            await updateOption.mutateAsync({
              key: 'InvitationRebateRatioBps',
              value: Math.round(Number(value) * 100),
            })
            continue
          }

          await updateOption.mutateAsync({
            key,
            value: value as string | number | boolean,
          })
        }
      },
    })

  return (
    <SettingsSection
      title={t('Quota Settings')}
      description={t('Configure user quota allocation and rewards')}
    >
      <FormNavigationGuard when={isDirty} />

      <Form {...form}>
        <form onSubmit={handleSubmit} className='space-y-6'>
          <FormDirtyIndicator isDirty={isDirty} />
          <FormField
            control={form.control}
            name='QuotaForNewUser'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('New User Quota')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    value={field.value ?? ''}
                    onChange={handleNumberChange(field.onChange)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  {t('Initial quota given to new users')}
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
                <FormLabel>{t('Pre-Consumed Quota')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    value={field.value ?? ''}
                    onChange={handleNumberChange(field.onChange)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  {t('Quota consumed before charging users')}
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
                <FormLabel>{t('Inviter Reward')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    value={field.value ?? ''}
                    onChange={handleNumberChange(field.onChange)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  {t('Quota given to users who invite others')}
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
                <FormLabel>{t('Invitee Reward')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    value={field.value ?? ''}
                    onChange={handleNumberChange(field.onChange)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  {t('Quota given to invited users')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='space-y-4 rounded-lg border p-4'>
            <div className='space-y-1'>
              <h4 className='text-sm font-medium'>{t('Invitation Rebate')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t(
                  "Configure cumulative rebates from invited users' actual consumption"
                )}
              </p>
            </div>

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
                        "Accumulate invited users' actual consumed quota and grant inviter rewards after the configured threshold is reached. Rebates are not based on top-ups."
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
                name='InvitationRebateRatioPercent'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Rebate Percentage')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        max={100}
                        step={0.01}
                        value={field.value ?? ''}
                        onChange={handleNumberChange(field.onChange)}
                        name={field.name}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Enter 10 for 10%. Rebates are based on actual consumed quota, not top-ups.'
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
                    <FormLabel>
                      {t('Cumulative Trigger Consumption Quota')}
                    </FormLabel>
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
                        'Grant rebates when cumulative actual consumed quota reaches this value. Unsettled quota keeps accumulating.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name='quota_setting.enable_free_model_pre_consume'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    {t('Pre-Consume for Free Models')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'When enabled, zero-cost models also pre-consume quota before final settlement.'
                    )}
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
                <FormLabel>{t('Top-Up Link')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('https://example.com/topup')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('External link for users to purchase quota')}
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
                <FormLabel>{t('Documentation Link')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('https://docs.example.com')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('Link to your documentation site')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type='submit'
            disabled={updateOption.isPending || isSubmitting}
          >
            {updateOption.isPending ? t('Saving...') : t('Save Changes')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
