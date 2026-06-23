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
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
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
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const privacyFilterSchema = z.object({
  privacy_filter_setting: z.object({
    enabled: z.boolean(),
    gitleaks_toml: z.string(),
  }),
})

type PrivacyFilterFormValues = z.infer<typeof privacyFilterSchema>

type PrivacyFilterSettingsValues = {
  'privacy_filter_setting.enabled': boolean
  'privacy_filter_setting.gitleaks_toml': string
}

type PrivacyFilterSectionProps = {
  defaultValues: PrivacyFilterSettingsValues
}

const buildFormDefaults = (
  defaults: PrivacyFilterSettingsValues
): PrivacyFilterFormValues => ({
  privacy_filter_setting: {
    enabled: defaults['privacy_filter_setting.enabled'],
    gitleaks_toml: defaults['privacy_filter_setting.gitleaks_toml'],
  },
})

const normalizeDefaults = (
  defaults: PrivacyFilterSettingsValues
): PrivacyFilterSettingsValues => ({
  'privacy_filter_setting.enabled': defaults['privacy_filter_setting.enabled'],
  'privacy_filter_setting.gitleaks_toml':
    defaults['privacy_filter_setting.gitleaks_toml'].trim(),
})

const normalizeFormValues = (
  values: PrivacyFilterFormValues
): PrivacyFilterSettingsValues => ({
  'privacy_filter_setting.enabled': values.privacy_filter_setting.enabled,
  'privacy_filter_setting.gitleaks_toml':
    values.privacy_filter_setting.gitleaks_toml.trim(),
})

export function PrivacyFilterSection({
  defaultValues,
}: PrivacyFilterSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const formDefaults = buildFormDefaults(defaultValues)

  const form = useForm<PrivacyFilterFormValues>({
    resolver: zodResolver(privacyFilterSchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const onSubmit = async (values: PrivacyFilterFormValues) => {
    const sanitizedValues = normalizeFormValues(values)
    const sanitizedDefaults = normalizeDefaults(defaultValues)

    const updates = Object.entries(sanitizedValues).filter(
      ([key, value]) =>
        value !== sanitizedDefaults[key as keyof PrivacyFilterSettingsValues]
    )

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value })
    }
  }

  return (
    <SettingsSection title={t('Privacy Filter')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save privacy filter settings'
          />

          <FormField
            control={form.control}
            name='privacy_filter_setting.enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable privacy filter')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Redact secrets and personal data in relay requests before they are sent upstream.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <FormField
            control={form.control}
            name='privacy_filter_setting.gitleaks_toml'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Gitleaks TOML path')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='/app/privacy-filter-rules/gitleaks.toml'
                    autoComplete='off'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Leave empty to use the built-in fallback rules. In Docker, use a container path rather than a host path.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
