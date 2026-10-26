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
import { useEffect, useId, useMemo } from 'react'
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
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsFormGrid,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'
import { HistoryLogCleanup } from './history-log-cleanup'
import { ServerLogFiles } from './server-log-files'

const logSettingsSchema = z.object({
  LogConsumeEnabled: z.boolean(),
  log_setting: z.object({
    user_export_enabled: z.boolean(),
    max_range_days: z.number().int().min(1),
  }),
})

type LogSettingsFormValues = z.infer<typeof logSettingsSchema>

type LogSettingsSectionProps = {
  defaultValues: {
    LogConsumeEnabled: boolean
    'log_setting.user_export_enabled': boolean
    'log_setting.max_range_days': number
  }
}

export function LogSettingsSection(props: LogSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const recordingTitleId = useId()
  const searchTitleId = useId()
  const formDefaults = useMemo<LogSettingsFormValues>(
    () => ({
      LogConsumeEnabled: props.defaultValues.LogConsumeEnabled,
      log_setting: {
        user_export_enabled:
          props.defaultValues['log_setting.user_export_enabled'],
        max_range_days: props.defaultValues['log_setting.max_range_days'],
      },
    }),
    [props.defaultValues]
  )
  const form = useForm<LogSettingsFormValues>({
    resolver: zodResolver(logSettingsSchema),
    defaultValues: formDefaults,
  })

  useEffect(() => {
    form.reset(formDefaults)
  }, [formDefaults, form])

  const onSubmit = async (values: LogSettingsFormValues) => {
    const changes = [
      ['LogConsumeEnabled', values.LogConsumeEnabled],
      [
        'log_setting.user_export_enabled',
        values.log_setting.user_export_enabled,
      ],
      ['log_setting.max_range_days', values.log_setting.max_range_days],
    ] as const
    for (const [key, value] of changes) {
      if (value === props.defaultValues[key]) continue
      await updateOption.mutateAsync({ key, value })
    }
  }

  return (
    <SettingsSection title={t('Log Maintenance')} className='gap-6'>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save log settings'
          />
          <div
            role='group'
            aria-labelledby={recordingTitleId}
            className='flex min-w-0 flex-col gap-4'
          >
            <h4 id={recordingTitleId} className='font-medium'>
              {t('Log recording')}
            </h4>
            <FormField
              control={form.control}
              name='LogConsumeEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Record quota usage')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Track per-request consumption to power usage analytics. Keeping this on increases database writes.'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </SettingsSwitchItem>
              )}
            />
          </div>

          <Separator />

          <div
            role='group'
            aria-labelledby={searchTitleId}
            className='flex min-w-0 flex-col gap-4'
          >
            <h4 id={searchTitleId} className='font-medium'>
              {t('Log search and export')}
            </h4>
            <SettingsFormGrid>
              <FormField
                control={form.control}
                name='log_setting.user_export_enabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Allow users to export logs')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Users can download their own logs from the usage log page. Administrators can always export.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </SettingsSwitchItem>
                )}
              />
              <FormField
                control={form.control}
                name='log_setting.max_range_days'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Longest log time range (days)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        step={1}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'The longest time range a user can view at once in the logs and on the dashboard, and the longest range any export can cover.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsFormGrid>
          </div>
        </SettingsForm>
      </Form>

      <Separator />

      <HistoryLogCleanup />

      <Separator />

      <ServerLogFiles />
    </SettingsSection>
  )
}
