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
import type { TFunction } from 'i18next'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import {
  INVITATION_REGISTRATION_METHODS,
  type InvitationRegistrationMethod,
} from '@/features/auth/lib/invitation'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateInvitationCodeConfig } from '../hooks/use-update-invitation-code-config'

const invitationCodeSchema = z
  .object({
    InvitationCodeRequired: z.boolean(),
    InvitationCodeMethods: z.array(z.enum(INVITATION_REGISTRATION_METHODS)),
  })
  .refine(
    (value) =>
      !value.InvitationCodeRequired || value.InvitationCodeMethods.length > 0,
    {
      path: ['InvitationCodeMethods'],
      message: 'Select at least one registration method',
    }
  )

type InvitationCodeFormValues = z.infer<typeof invitationCodeSchema>

type InvitationCodeSectionProps = {
  defaultValues: {
    InvitationCodeRequired: boolean
    InvitationCodeMethods: string[]
  }
}

function getMethodLabel(
  method: InvitationRegistrationMethod,
  t: TFunction
): string {
  switch (method) {
    case 'password':
      return t('Password registration')
    case 'github':
      return t('GitHub OAuth')
    case 'discord':
      return t('Discord OAuth')
    case 'linuxdo':
      return t('LinuxDO OAuth')
    case 'oidc':
      return t('OIDC')
    case 'custom_oauth':
      return t('Custom OAuth')
    case 'wechat':
      return t('WeChat')
  }
}

export function InvitationCodeSection(props: InvitationCodeSectionProps) {
  const { t } = useTranslation()
  const updateInvitationCodeConfig = useUpdateInvitationCodeConfig()
  const formDefaults = useMemo<InvitationCodeFormValues>(() => {
    const methods = INVITATION_REGISTRATION_METHODS.filter((method) =>
      props.defaultValues.InvitationCodeMethods.includes(method)
    )
    return {
      InvitationCodeRequired: props.defaultValues.InvitationCodeRequired,
      InvitationCodeMethods: methods,
    }
  }, [props.defaultValues])

  const form = useForm<InvitationCodeFormValues>({
    resolver: zodResolver(invitationCodeSchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const onSubmit = async (values: InvitationCodeFormValues) => {
    const methods = INVITATION_REGISTRATION_METHODS.filter((method) =>
      values.InvitationCodeMethods.includes(method)
    )
    const methodsChanged =
      JSON.stringify(methods) !==
      JSON.stringify(formDefaults.InvitationCodeMethods)
    const requiredChanged =
      values.InvitationCodeRequired !== formDefaults.InvitationCodeRequired
    if (!methodsChanged && !requiredChanged) return

    try {
      await updateInvitationCodeConfig.mutateAsync({
        required: values.InvitationCodeRequired,
        methods,
      })
    } catch {
      // The mutation owns error feedback and keeps the form unchanged.
    }
  }

  return (
    <SettingsSection title={t('Invitation codes')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateInvitationCodeConfig.isPending}
          />
          <FormField
            control={form.control}
            name='InvitationCodeRequired'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Require invitation codes')}</FormLabel>
                  <FormDescription>
                    {t('Require a valid code before creating a new account')}
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
            name='InvitationCodeMethods'
            render={({ field }) => (
              <FormItem data-settings-form-span='full'>
                <FormLabel>{t('Registration methods')}</FormLabel>
                <FormDescription>
                  {t('Choose which new-account flows require a code')}
                </FormDescription>
                <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                  {INVITATION_REGISTRATION_METHODS.map((method) => (
                    <label
                      key={method}
                      className='hover:bg-muted/40 flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm'
                    >
                      <Checkbox
                        checked={field.value.includes(method)}
                        onCheckedChange={(checked) => {
                          const nextValue = checked
                            ? [...field.value, method]
                            : field.value.filter((value) => value !== method)
                          field.onChange(nextValue)
                        }}
                      />
                      <span>{getMethodLabel(method, t)}</span>
                    </label>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
