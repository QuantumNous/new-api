/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    70|but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  DEFAULT_EXTENSION_VISIBILITY,
  EXTENSION_VISIBILITY_OPTIONS,
  resolveExtensionVisibility,
} from './constants'

const availabilityMonitorSchema = z.object({
  'console_setting.availability_monitor_enabled': z.boolean(),
  'console_setting.availability_monitor_visibility': z.enum(['all', 'admin']),
})

type AvailabilityMonitorFormValues = z.infer<typeof availabilityMonitorSchema>

type AvailabilityMonitorSectionProps = {
  defaultValues: AvailabilityMonitorFormValues
}

export function AvailabilityMonitorSection(
  props: AvailabilityMonitorSectionProps
) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<AvailabilityMonitorFormValues>({
    resolver: zodResolver(availabilityMonitorSchema),
    defaultValues: {
      ...props.defaultValues,
      'console_setting.availability_monitor_visibility':
        resolveExtensionVisibility(
          props.defaultValues[
            'console_setting.availability_monitor_visibility'
          ]
        ),
    },
  })

  useEffect(() => {
    form.reset({
      ...props.defaultValues,
      'console_setting.availability_monitor_visibility':
        resolveExtensionVisibility(
          props.defaultValues[
            'console_setting.availability_monitor_visibility'
          ] || DEFAULT_EXTENSION_VISIBILITY
        ),
    })
  }, [props.defaultValues, form])

  const onSubmit = async (values: AvailabilityMonitorFormValues) => {
    const updates = Object.entries(values).filter(
      ([key, value]) =>
        value !==
        props.defaultValues[key as keyof AvailabilityMonitorFormValues]
    )

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value })
    }
  }

  return (
    <SettingsSection title={t('Availability Monitor')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name='console_setting.availability_monitor_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable availability monitor')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Shows a group-level request heartbeat chart under Extensions. Failed requests require ERROR_LOG_ENABLED.'
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
            name='console_setting.availability_monitor_visibility'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Visibility')}</FormLabel>
                <Select
                  items={EXTENSION_VISIBILITY_OPTIONS.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('Select visibility')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {EXTENSION_VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t(
                    'Choose who can see the Availability Monitor entry in the Extensions sidebar.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save Changes'
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
