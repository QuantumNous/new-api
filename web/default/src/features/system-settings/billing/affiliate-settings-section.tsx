import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const MICROS_PER_UNIT = 1_000_000
const SECONDS_PER_DAY = 86_400
const BASIS_POINTS_PER_PERCENT = 100

const schema = z.object({
  enabled: z.boolean(),
  rewardRate: z.coerce.number().min(0).max(100),
  maximumReward: z.coerce.number().min(0),
  minimumTopUp: z.coerce.number().min(0),
  holdDays: z.coerce.number().int().min(0).max(365),
  minimumWithdrawal: z.coerce.number().min(0),
})

type Values = z.infer<typeof schema>

interface AffiliateSettingsSectionProps {
  defaultValues: {
    enabled: boolean
    rewardRateBps: number
    rewardMicros: number
    minimumTopUpMicros: number
    holdSeconds: number
    minimumWithdrawalMicros: number
  }
}

export function AffiliateSettingsSection(props: AffiliateSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const defaults: Values = {
    enabled: props.defaultValues.enabled,
    rewardRate: props.defaultValues.rewardRateBps / BASIS_POINTS_PER_PERCENT,
    maximumReward: props.defaultValues.rewardMicros / MICROS_PER_UNIT,
    minimumTopUp: props.defaultValues.minimumTopUpMicros / MICROS_PER_UNIT,
    holdDays: Math.round(props.defaultValues.holdSeconds / SECONDS_PER_DAY),
    minimumWithdrawal:
      props.defaultValues.minimumWithdrawalMicros / MICROS_PER_UNIT,
  }
  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: defaults,
  })
  const enabled = form.watch('enabled')

  async function onSubmit(values: Values) {
    const updates = [
      {
        key: 'affiliate_setting.enabled',
        value: String(values.enabled),
        changed: values.enabled !== defaults.enabled,
      },
      {
        key: 'affiliate_setting.reward_rate_bps',
        value: String(Math.round(values.rewardRate * BASIS_POINTS_PER_PERCENT)),
        changed: values.rewardRate !== defaults.rewardRate,
      },
      {
        key: 'affiliate_setting.reward_micros',
        value: String(Math.round(values.maximumReward * MICROS_PER_UNIT)),
        changed: values.maximumReward !== defaults.maximumReward,
      },
      {
        key: 'affiliate_setting.minimum_topup_micros',
        value: String(Math.round(values.minimumTopUp * MICROS_PER_UNIT)),
        changed: values.minimumTopUp !== defaults.minimumTopUp,
      },
      {
        key: 'affiliate_setting.hold_seconds',
        value: String(values.holdDays * SECONDS_PER_DAY),
        changed: values.holdDays !== defaults.holdDays,
      },
      {
        key: 'affiliate_setting.minimum_withdrawal_micros',
        value: String(Math.round(values.minimumWithdrawal * MICROS_PER_UNIT)),
        changed: values.minimumWithdrawal !== defaults.minimumWithdrawal,
      },
    ].filter((update) => update.changed)

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    for (const update of updates) {
      await updateOption.mutateAsync({ key: update.key, value: update.value })
    }
    form.reset(values)
  }

  return (
    <SettingsSection title={t('Referral Cashback')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || form.formState.isSubmitting}
            isSaveDisabled={!form.formState.isDirty}
            saveLabel='Save referral cashback settings'
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable referral cashback')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Bind referrals at registration and reward the inviter after a qualifying top-up.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled ? (
            <div className='grid gap-6 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='rewardRate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Cashback rate')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        max={100}
                        step='0.01'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Percentage of the paid amount')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='maximumReward'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Maximum cashback per referral')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} step='0.01' {...field} />
                    </FormControl>
                    <FormDescription>{t('Amount in CNY')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='minimumTopUp'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Qualifying top-up')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} step='0.01' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('Minimum paid amount in CNY')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='holdDays'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Settlement hold')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} max={365} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('Hold period in days')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='minimumWithdrawal'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Minimum withdrawal')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} step='0.01' {...field} />
                    </FormControl>
                    <FormDescription>{t('Amount in CNY')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : null}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
