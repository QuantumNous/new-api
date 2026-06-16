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
import { z } from 'zod'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z
  .object({
    enabled: z.boolean(),
    level1RatePercent: z.coerce.number().min(0).max(100),
    level2RatePercent: z.coerce.number().min(0).max(100),
    cdkPurchaseDiscountPercent: z.coerce.number().min(0).max(99.99),
  })
  .refine(
    (values) => values.level1RatePercent + values.level2RatePercent <= 100,
    {
      message: 'Total reward rate cannot exceed 100%',
      path: ['level2RatePercent'],
    }
  )

type Values = z.infer<typeof schema>

type Props = {
  defaultValues: {
    enabled: boolean
    level1RateBps: number
    level2RateBps: number
    cdkPurchaseDiscountBps: number
  }
  complianceConfirmed: boolean
}

type DistributionOptionUpdate = { key: string; value: string }

function percentToBps(percent: number) {
  return Math.round(percent * 100)
}

function bpsToPercent(bps: number) {
  return Number(((bps || 0) / 100).toFixed(2))
}

function buildRateUpdates(
  level1RateBps: number,
  level2RateBps: number,
  cdkPurchaseDiscountBps: number,
  defaultValues: Props['defaultValues']
) {
  const rateUpdates = [
    {
      key: 'distribution_setting.level1_rate_bps',
      value: String(level1RateBps),
      current: defaultValues.level1RateBps,
      next: level1RateBps,
    },
    {
      key: 'distribution_setting.level2_rate_bps',
      value: String(level2RateBps),
      current: defaultValues.level2RateBps,
      next: level2RateBps,
    },
    {
      key: 'distribution_setting.cdk_purchase_discount_bps',
      value: String(cdkPurchaseDiscountBps),
      current: defaultValues.cdkPurchaseDiscountBps,
      next: cdkPurchaseDiscountBps,
    },
  ].filter((update) => update.next !== update.current)

  return rateUpdates
    .sort((a, b) => {
      const aDirection = a.next < a.current ? 0 : 1
      const bDirection = b.next < b.current ? 0 : 1
      return aDirection - bDirection
    })
    .map(({ key, value }) => ({ key, value }))
}

export function DistributionSettingsSection({
  defaultValues,
  complianceConfirmed,
}: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const defaults: Values = {
    enabled: defaultValues.enabled,
    level1RatePercent: bpsToPercent(defaultValues.level1RateBps),
    level2RatePercent: bpsToPercent(defaultValues.level2RateBps),
    cdkPurchaseDiscountPercent: bpsToPercent(
      defaultValues.cdkPurchaseDiscountBps
    ),
  }

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: defaults,
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')

  async function onSubmit(values: Values) {
    const level1RateBps = percentToBps(values.level1RatePercent)
    const level2RateBps = percentToBps(values.level2RatePercent)
    const cdkPurchaseDiscountBps = percentToBps(
      values.cdkPurchaseDiscountPercent
    )

    if (
      (values.enabled ||
        level1RateBps > 0 ||
        level2RateBps > 0 ||
        cdkPurchaseDiscountBps > 0) &&
      !complianceConfirmed
    ) {
      toast.error(
        t(
          'Complete payment compliance confirmation before enabling distribution.'
        )
      )
      return
    }

    const updates: DistributionOptionUpdate[] = [
      ...buildRateUpdates(
        level1RateBps,
        level2RateBps,
        cdkPurchaseDiscountBps,
        defaultValues
      ),
    ]
    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'distribution_setting.enabled',
        value: String(values.enabled),
      })
    }
    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      const result = await updateOption.mutateAsync(update)
      if (!result.success) return
    }
    form.reset(values)
  }

  const handleReset = () => {
    form.reset()
  }

  return (
    <SettingsSection
      title={t('Distribution')}
      description={t('Configure two-level wallet top-up reward points')}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          autoComplete='off'
          className='flex flex-col gap-6'
        >
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            onReset={handleReset}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            isResetDisabled={!isDirty}
            saveLabel='Save distribution settings'
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    {t('Enable distribution')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'When enabled, users can earn reward points from qualified invitee credited wallet units.'
                    )}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={
                      updateOption.isPending ||
                      isSubmitting ||
                      (!complianceConfirmed && !enabled)
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {!complianceConfirmed && (
            <p className='text-muted-foreground text-sm'>
              {t(
                'Distribution stays locked until the root administrator confirms payment compliance terms.'
              )}
            </p>
          )}

          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            <FormField
              control={form.control}
              name='level1RatePercent'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Level 1 reward rate (%)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      max={100}
                      step={0.01}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      "Buyer inviter's reward point rate based on credited wallet units"
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='level2RatePercent'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Level 2 reward rate (%)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      max={100}
                      step={0.01}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      "Inviter's inviter reward point rate based on credited wallet units"
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='cdkPurchaseDiscountPercent'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('Affiliate CDK purchase discount (%)')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      max={99.99}
                      step={0.01}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Set 0 to disable affiliate CDK purchases; positive values must stay below 100%.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </SettingsSection>
  )
}
