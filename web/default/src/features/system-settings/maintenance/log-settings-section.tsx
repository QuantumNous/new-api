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
import { useEffect, useMemo, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatTimestampToDate } from '@/lib/format'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { DateTimePicker } from '@/components/datetime-picker'
import { deleteLogsBefore } from '../api'
import {
  SettingsControlGroup,
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const logSettingsSchema = z.object({
  LogConsumeEnabled: z.boolean(),
  ConversationArchiveEnabled: z.boolean(),
  ConversationArchiveDumpEnabled: z.boolean(),
  ConversationArchiveR2Enabled: z.boolean(),
  ConversationArchiveDeleteLocalDumpAfterUpload: z.boolean(),
  ConversationArchiveRetentionDays: z.number().int().min(0).max(3650),
})

type LogSettingsFormValues = z.infer<typeof logSettingsSchema>

type LogSettingsSectionProps = {
  defaultEnabled: boolean
  defaultArchiveEnabled: boolean
  defaultArchiveDumpEnabled: boolean
  defaultArchiveR2Enabled: boolean
  defaultArchiveDeleteLocalDumpAfterUpload: boolean
  defaultArchiveRetentionDays: number
}

const HOURS_IN_DAY = 24

const getDateHoursAgo = (hours: number) => {
  const date = new Date()
  date.setHours(date.getHours() - hours)
  return date
}

const getDateDaysAgo = (days: number) => getDateHoursAgo(days * HOURS_IN_DAY)

const quickSelectOptions = [
  {
    label: '24 hours ago',
    getValue: () => getDateHoursAgo(24),
  },
  {
    label: '7 days ago',
    getValue: () => getDateDaysAgo(7),
  },
  {
    label: '30 days ago',
    getValue: () => getDateDaysAgo(30),
  },
]

export function LogSettingsSection({
  defaultEnabled,
  defaultArchiveEnabled,
  defaultArchiveDumpEnabled,
  defaultArchiveR2Enabled,
  defaultArchiveDeleteLocalDumpAfterUpload,
  defaultArchiveRetentionDays,
}: LogSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<LogSettingsFormValues>({
    resolver: zodResolver(logSettingsSchema),
    defaultValues: {
      LogConsumeEnabled: defaultEnabled,
      ConversationArchiveEnabled: defaultArchiveEnabled,
      ConversationArchiveDumpEnabled: defaultArchiveDumpEnabled,
      ConversationArchiveR2Enabled: defaultArchiveR2Enabled,
      ConversationArchiveDeleteLocalDumpAfterUpload:
        defaultArchiveDeleteLocalDumpAfterUpload,
      ConversationArchiveRetentionDays: defaultArchiveRetentionDays,
    },
  })

  const [purgeDate, setPurgeDate] = useState<Date | undefined>(() =>
    getDateDaysAgo(30)
  )
  const [isCleaning, setIsCleaning] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    form.reset({
      LogConsumeEnabled: defaultEnabled,
      ConversationArchiveEnabled: defaultArchiveEnabled,
      ConversationArchiveDumpEnabled: defaultArchiveDumpEnabled,
      ConversationArchiveR2Enabled: defaultArchiveR2Enabled,
      ConversationArchiveDeleteLocalDumpAfterUpload:
        defaultArchiveDeleteLocalDumpAfterUpload,
      ConversationArchiveRetentionDays: defaultArchiveRetentionDays,
    })
  }, [
    defaultArchiveDeleteLocalDumpAfterUpload,
    defaultArchiveDumpEnabled,
    defaultArchiveEnabled,
    defaultArchiveR2Enabled,
    defaultArchiveRetentionDays,
    defaultEnabled,
    form,
  ])

  const purgeTimestamp = useMemo(() => {
    if (!purgeDate) return null
    return Math.floor(purgeDate.getTime() / 1000)
  }, [purgeDate])

  const formattedPurgeDate = useMemo(() => {
    if (!purgeDate) return ''
    return formatTimestampToDate(purgeDate.getTime(), 'milliseconds')
  }, [purgeDate])

  const onSubmit = async (values: LogSettingsFormValues) => {
    const updates: Array<{ key: string; value: boolean | number }> = []
    if (values.LogConsumeEnabled !== defaultEnabled) {
      updates.push({
        key: 'LogConsumeEnabled',
        value: values.LogConsumeEnabled,
      })
    }
    if (values.ConversationArchiveEnabled !== defaultArchiveEnabled) {
      updates.push({
        key: 'conversation_archive_setting.enabled',
        value: values.ConversationArchiveEnabled,
      })
    }
    if (values.ConversationArchiveDumpEnabled !== defaultArchiveDumpEnabled) {
      updates.push({
        key: 'conversation_archive_setting.dump_enabled',
        value: values.ConversationArchiveDumpEnabled,
      })
    }
    if (values.ConversationArchiveR2Enabled !== defaultArchiveR2Enabled) {
      updates.push({
        key: 'conversation_archive_setting.r2_enabled',
        value: values.ConversationArchiveR2Enabled,
      })
    }
    if (
      values.ConversationArchiveDeleteLocalDumpAfterUpload !==
      defaultArchiveDeleteLocalDumpAfterUpload
    ) {
      updates.push({
        key: 'conversation_archive_setting.delete_local_dump_after_upload',
        value: values.ConversationArchiveDeleteLocalDumpAfterUpload,
      })
    }
    if (
      values.ConversationArchiveRetentionDays !== defaultArchiveRetentionDays
    ) {
      updates.push({
        key: 'conversation_archive_setting.retention_days',
        value: values.ConversationArchiveRetentionDays,
      })
    }
    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  const handleRequestCleanLogs = () => {
    if (!purgeTimestamp) {
      toast.error(t('Select a timestamp before clearing logs.'))
      return
    }

    setShowConfirmDialog(true)
  }

  const handleCleanLogs = async () => {
    if (!purgeTimestamp) {
      toast.error(t('Select a timestamp before clearing logs.'))
      return
    }

    setIsCleaning(true)
    try {
      const res = await deleteLogsBefore(purgeTimestamp)
      if (!res.success) {
        throw new Error(res.message || t('Failed to clean logs'))
      }
      const count = res.data ?? 0
      toast.success(
        count > 0
          ? t('{{count}} log entries removed.', { count })
          : t('No log entries matched the selected time.')
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to clean logs')
      toast.error(message)
    } finally {
      setIsCleaning(false)
    }
  }

  return (
    <SettingsSection title={t('Log Maintenance')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save log settings'
          />
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
            name='ConversationArchiveEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Collect conversation archive')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Store request and response bodies for non-admin relay requests. Environment archive settings must also be enabled.'
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
          <SettingsControlGroup className='space-y-3'>
            <div>
              <h4 className='text-sm font-medium'>
                {t('Archive dump and retention')}
              </h4>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Control daily dump, Cloudflare R2 upload, and archive table retention.'
                )}
              </p>
            </div>
            <FormField
              control={form.control}
              name='ConversationArchiveDumpEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Enable daily archive dump')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Write completed daily archive tables to local jsonl.gz files. Environment dump settings must also be enabled.'
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
              name='ConversationArchiveR2Enabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Upload dumps to Cloudflare R2')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Upload local dump files to Cloudflare R2 when R2 environment credentials are configured.'
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
              name='ConversationArchiveDeleteLocalDumpAfterUpload'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>
                      {t('Delete local dump after R2 upload')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'Remove the local dump file after Cloudflare R2 upload succeeds.'
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
              name='ConversationArchiveRetentionDays'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Archive table retention days')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      max={3650}
                      step={1}
                      value={Number.isFinite(field.value) ? field.value : ''}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === ''
                            ? 0
                            : Number(event.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Drop normal and abnormal archive date tables older than this many days. Set 0 to keep database tables.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsControlGroup>

          <SettingsControlGroup className='space-y-3'>
            <div>
              <h4 className='text-sm font-medium'>{t('Clean history logs')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Remove all log entries created before the selected timestamp.'
                )}
              </p>
            </div>
            <DateTimePicker value={purgeDate} onChange={setPurgeDate} />
            <div className='flex flex-wrap gap-3'>
              {quickSelectOptions.map((option) => (
                <Button
                  key={option.label}
                  type='button'
                  variant='outline'
                  onClick={() => setPurgeDate(option.getValue())}
                >
                  {t(option.label)}
                </Button>
              ))}
              <Button
                type='button'
                variant='destructive'
                onClick={handleRequestCleanLogs}
                disabled={isCleaning}
              >
                {isCleaning ? t('Cleaning...') : t('Clean logs')}
              </Button>
            </div>
          </SettingsControlGroup>
        </SettingsForm>
      </Form>
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Confirm log cleanup')}</AlertDialogTitle>
            <AlertDialogDescription>
              {formattedPurgeDate
                ? t(
                    'This will permanently remove all log entries created before {{date}}.',
                    { date: formattedPurgeDate }
                  )
                : t(
                    'This will permanently remove log entries before the selected timestamp.'
                  )}{' '}
              {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCleaning}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanLogs} disabled={isCleaning}>
              {isCleaning ? t('Cleaning...') : t('Delete logs')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  )
}
