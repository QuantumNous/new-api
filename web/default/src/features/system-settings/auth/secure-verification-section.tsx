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
import { useMemo } from 'react'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormLabel,
} from '@/components/ui/form'
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

const secureVerificationSchema = z.object({
  secure_verification: z.object({
    sensitive_operations_required: z.boolean(),
  }),
})

type SecureVerificationFormValues = z.infer<typeof secureVerificationSchema>

type FlatSecureVerificationDefaults = {
  'secure_verification.sensitive_operations_required': boolean
}

type SecureVerificationSectionProps = {
  defaultValues: FlatSecureVerificationDefaults
}

function buildFormDefaults(
  defaults: FlatSecureVerificationDefaults
): SecureVerificationFormValues {
  return {
    secure_verification: {
      sensitive_operations_required:
        defaults['secure_verification.sensitive_operations_required'],
    },
  }
}

export function SecureVerificationSection({
  defaultValues,
}: SecureVerificationSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const formDefaults = useMemo(
    () => buildFormDefaults(defaultValues),
    [defaultValues]
  )

  const form = useForm<SecureVerificationFormValues>({
    resolver: zodResolver(secureVerificationSchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const onSubmit = async (values: SecureVerificationFormValues) => {
    const nextValue =
      values.secure_verification.sensitive_operations_required
    const previousValue =
      defaultValues['secure_verification.sensitive_operations_required']

    if (nextValue === previousValue) {
      return
    }

    await updateOption.mutateAsync({
      key: 'secure_verification.sensitive_operations_required',
      value: nextValue,
    })
  }

  return (
    <SettingsSection title={t('Security Verification')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormField
            control={form.control}
            name='secure_verification.sensitive_operations_required'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>
                    {t('Require verification for sensitive operations')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'When enabled, selected sensitive actions require a recent 2FA or Passkey verification.'
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
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
