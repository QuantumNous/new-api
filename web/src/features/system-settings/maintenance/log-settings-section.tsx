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
import { useEffect, useId, useMemo, useRef } from 'react'
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
  LogRecordClientInfoEnabled: z.boolean(),
  LogClientInfoUserVisibleEnabled: z.boolean(),
  log_setting: z.object({
    user_export_enabled: z.boolean(),
    max_range_days: z.number().int().min(1),
  }),
})

type LogSettingsFormValues = z.infer<typeof logSettingsSchema>

type LogSettingsSectionProps = {
  defaultValues: {
    LogConsumeEnabled: boolean
    LogRecordClientInfoEnabled: boolean
    LogClientInfoUserVisibleEnabled: boolean
    'log_setting.user_export_enabled': boolean
    'log_setting.max_range_days': number
  }
}

// Persisted option values, flattened to the same keys the settings form
// submits. The form nests the log_setting keys, so the baseline copy lives in
// option-key space to make "did the server echo a value we already saved?"
// comparisons direct.
type LogSettingsSnapshot = {
  LogConsumeEnabled: boolean
  LogRecordClientInfoEnabled: boolean
  LogClientInfoUserVisibleEnabled: boolean
  'log_setting.user_export_enabled': boolean
  'log_setting.max_range_days': number
}

function snapshotOf(
  logConsumeEnabled: boolean,
  logRecordClientInfoEnabled: boolean,
  logClientInfoUserVisibleEnabled: boolean,
  userExportEnabled: boolean,
  maxRangeDays: number
): LogSettingsSnapshot {
  return {
    LogConsumeEnabled: logConsumeEnabled,
    LogRecordClientInfoEnabled: logRecordClientInfoEnabled,
    LogClientInfoUserVisibleEnabled: logClientInfoUserVisibleEnabled,
    'log_setting.user_export_enabled': userExportEnabled,
    'log_setting.max_range_days': maxRangeDays,
  }
}

function sameSnapshot(
  a: LogSettingsSnapshot,
  b: LogSettingsSnapshot
): boolean {
  return (
    a.LogConsumeEnabled === b.LogConsumeEnabled &&
    a.LogRecordClientInfoEnabled === b.LogRecordClientInfoEnabled &&
    a.LogClientInfoUserVisibleEnabled === b.LogClientInfoUserVisibleEnabled &&
    a['log_setting.user_export_enabled'] ===
      b['log_setting.user_export_enabled'] &&
    a['log_setting.max_range_days'] === b['log_setting.max_range_days']
  )
}

export function LogSettingsSection(props: LogSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const recordingTitleId = useId()
  const searchTitleId = useId()
  // Flat locals: the reset effect's dependency array must consist of simple
  // identifiers, and the parent registry rebuilds the defaults object on
  // every render, so dependending on the object identity would reset away
  // unsaved edits.
  const {
    LogConsumeEnabled: logConsumeEnabledDefault,
    LogRecordClientInfoEnabled: logRecordClientInfoEnabledDefault,
    LogClientInfoUserVisibleEnabled: logClientInfoUserVisibleEnabledDefault,
    'log_setting.user_export_enabled': userExportEnabledDefault,
    'log_setting.max_range_days': maxRangeDaysDefault,
  } = props.defaultValues
  const formDefaults = useMemo<LogSettingsFormValues>(
    () => ({
      LogConsumeEnabled: logConsumeEnabledDefault,
      LogRecordClientInfoEnabled: logRecordClientInfoEnabledDefault,
      LogClientInfoUserVisibleEnabled: logClientInfoUserVisibleEnabledDefault,
      log_setting: {
        user_export_enabled: userExportEnabledDefault,
        max_range_days: maxRangeDaysDefault,
      },
    }),
    [
      logConsumeEnabledDefault,
      logRecordClientInfoEnabledDefault,
      logClientInfoUserVisibleEnabledDefault,
      userExportEnabledDefault,
      maxRangeDaysDefault,
    ]
  )
  const form = useForm<LogSettingsFormValues>({
    resolver: zodResolver(logSettingsSchema),
    defaultValues: formDefaults,
  })

  // Last values known to be persisted on the server. defaultValues comes from
  // a query and can lag behind our own successful saves; comparing against it
  // would silently drop a reversal saved inside that window. Own a snapshot
  // and advance it per saved key so a refetch that echoes older values does
  // not resurrect them over an edit made in flight.
  const lastSavedRef = useRef<LogSettingsSnapshot>(
    snapshotOf(
      logConsumeEnabledDefault,
      logRecordClientInfoEnabledDefault,
      logClientInfoUserVisibleEnabledDefault,
      userExportEnabledDefault,
      maxRangeDaysDefault
    )
  )

  useEffect(() => {
    const saved = snapshotOf(
      logConsumeEnabledDefault,
      logRecordClientInfoEnabledDefault,
      logClientInfoUserVisibleEnabledDefault,
      userExportEnabledDefault,
      maxRangeDaysDefault
    )
    if (sameSnapshot(saved, lastSavedRef.current)) return
    lastSavedRef.current = saved
    form.reset(formDefaults)
  }, [
    formDefaults,
    form,
    logConsumeEnabledDefault,
    logRecordClientInfoEnabledDefault,
    logClientInfoUserVisibleEnabledDefault,
    userExportEnabledDefault,
    maxRangeDaysDefault,
  ])

  const onSubmit = async (values: LogSettingsFormValues) => {
    const changes: Array<
      [keyof LogSettingsSnapshot, boolean | number, boolean | number]
    > = [
      [
        'LogConsumeEnabled',
        values.LogConsumeEnabled,
        lastSavedRef.current.LogConsumeEnabled,
      ],
      [
        'LogRecordClientInfoEnabled',
        values.LogRecordClientInfoEnabled,
        lastSavedRef.current.LogRecordClientInfoEnabled,
      ],
      [
        'LogClientInfoUserVisibleEnabled',
        values.LogClientInfoUserVisibleEnabled,
        lastSavedRef.current.LogClientInfoUserVisibleEnabled,
      ],
      [
        'log_setting.user_export_enabled',
        values.log_setting.user_export_enabled,
        lastSavedRef.current['log_setting.user_export_enabled'],
      ],
      [
        'log_setting.max_range_days',
        values.log_setting.max_range_days,
        lastSavedRef.current['log_setting.max_range_days'],
      ],
    ]
    for (const [key, value, savedValue] of changes) {
      if (value === savedValue) continue
      try {
        await updateOption.mutateAsync({ key, value })
      } catch {
        // The mutation's onError already reports the failure; stop applying
        // the remaining options so they keep their last saved values.
        return
      }
      lastSavedRef.current = { ...lastSavedRef.current, [key]: value }
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
            <FormField
              control={form.control}
              name='LogRecordClientInfoEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>
                      {t('Record caller IP and client identifier')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'Store the caller IP address and client identifier (User-Agent) in usage and error logs for security auditing.'
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
              name='LogClientInfoUserVisibleEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>
                      {t(
                        'Allow users to view their own IP and client identifier'
                      )}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'When enabled, users can see the caller IP and client identifier recorded on their own logs. Admins can always view this information.'
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
