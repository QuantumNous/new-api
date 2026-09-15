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
import type { Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

const quotaResetSchema = z.object({
  quota_reset_setting: z.object({
    enabled: z.boolean(),
    period: z.enum(['daily', 'weekly', 'monthly']),
    reset_value: z.coerce.number().min(0),
  }),
})

type QuotaResetFormValues = z.infer<typeof quotaResetSchema>

type QuotaResetSectionProps = {
  defaultValues: QuotaResetFormValues
}

export function QuotaResetSection({ defaultValues }: QuotaResetSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const currencyLabel = getCurrencyLabel()
  const { meta: currencyMeta } = getCurrencyDisplay()
  const tokensOnly = currencyMeta.kind === 'tokens'

  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<QuotaResetFormValues>({
      resolver: zodResolver(quotaResetSchema) as Resolver<
        QuotaResetFormValues,
        unknown,
        QuotaResetFormValues
      >,
      defaultValues: {
        ...defaultValues,
        quota_reset_setting: {
          ...defaultValues.quota_reset_setting,
          reset_value: quotaUnitsToDollars(
            defaultValues.quota_reset_setting.reset_value
          ),
        },
      },
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          if (value === undefined || value === null) continue

          const submitValue =
            key === 'quota_reset_setting.reset_value'
              ? parseQuotaFromDollars(value as number)
              : value

          await updateOption.mutateAsync({
            key,
            value: submitValue as string | number | boolean,
          })
        }
      },
    })

  const enabled = form.watch('quota_reset_setting.enabled')

  return (
    <SettingsSection title={t('Quota Reset')}>
      <Form {...form}>
        <SettingsForm onSubmit={handleSubmit}>
          <SettingsPageFormActions
            onSave={handleSubmit}
            onReset={handleReset}
            isSaving={updateOption.isPending || isSubmitting}
            isResetDisabled={!isDirty}
          />
          <FormField
            control={form.control}
            name='quota_reset_setting.enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable quota reset')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Automatically reset user quota on a recurring schedule'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled && (
            <div className='grid gap-6 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='quota_reset_setting.period'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Reset Period')}</FormLabel>
                    <Select
                      items={[
                        { value: 'daily', label: t('Daily') },
                        { value: 'weekly', label: t('Weekly') },
                        { value: 'monthly', label: t('Monthly') },
                      ]}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select reset period')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          <SelectItem value='daily'>{t('Daily')}</SelectItem>
                          <SelectItem value='weekly'>{t('Weekly')}</SelectItem>
                          <SelectItem value='monthly'>
                            {t('Monthly')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('How often user quota is reset')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='quota_reset_setting.reset_value'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('Reset value ({{currency}})', {
                        currency: currencyLabel,
                      })}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step={tokensOnly ? 1 : 0.000001}
                        min={0}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Quota amount users are reset to at each cycle')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
