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
import { safeNumberFieldProps } from '../utils/numeric-field'

const MAX_LOG_RETENTION_DAYS = 3650
const logSettingsSchema = z.object({
  LogConsumeEnabled: z.boolean(),
  LogRetentionDays: z.number().int().min(0).max(MAX_LOG_RETENTION_DAYS),
})

type LogSettingsFormValues = z.infer<typeof logSettingsSchema>

type LogSettingsSectionProps = {
  defaultValues: LogSettingsFormValues
}

const HOURS_IN_DAY = 24

const getDateHoursAgo = (hours: number) => {
  const date = new Date()
  date.setHours(date.getHours() - hours)
  return date
}

const getDateDaysAgo = (days: number) => getDateHoursAgo(days * HOURS_IN_DAY)

const getRetentionCutoffDate = (days: number) => {
  const date = new Date()
  if (days > 0) {
    date.setDate(date.getDate() - days)
  }
  return date
}

const quickSelectOptions = [
  {
    label: '24 hours ago',
    getValue: () => getDateHoursAgo(24),
    maxRetentionDays: 1,
  },
  {
    label: '7 days ago',
    getValue: () => getDateDaysAgo(7),
    maxRetentionDays: 7,
  },
  {
    label: '30 days ago',
    getValue: () => getDateDaysAgo(30),
    maxRetentionDays: 30,
  },
]

export function LogSettingsSection({
  defaultValues,
}: LogSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const defaultLogConsumeEnabled = defaultValues.LogConsumeEnabled
  const defaultLogRetentionDays = defaultValues.LogRetentionDays
  const form = useForm<LogSettingsFormValues>({
    resolver: zodResolver(logSettingsSchema),
    defaultValues,
  })

  const [purgeDate, setPurgeDate] = useState<Date | undefined>(() =>
    getDateDaysAgo(30)
  )
  const [isCleaning, setIsCleaning] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    form.reset({
      LogConsumeEnabled: defaultLogConsumeEnabled,
      LogRetentionDays: defaultLogRetentionDays,
    })
  }, [defaultLogConsumeEnabled, defaultLogRetentionDays, form])

  const retentionDays = form.watch('LogRetentionDays')
  const boundedRetentionDays = Number.isFinite(retentionDays)
    ? Math.min(Math.max(retentionDays, 0), MAX_LOG_RETENTION_DAYS)
    : defaultLogRetentionDays

  const maxPurgeDate = useMemo(
    () => getRetentionCutoffDate(boundedRetentionDays),
    [boundedRetentionDays]
  )

  useEffect(() => {
    if (purgeDate && purgeDate.getTime() > maxPurgeDate.getTime()) {
      setPurgeDate(new Date(maxPurgeDate))
    }
  }, [maxPurgeDate, purgeDate])

  const purgeTimestamp = useMemo(() => {
    if (!purgeDate) return null
    return Math.floor(purgeDate.getTime() / 1000)
  }, [purgeDate])

  const formattedPurgeDate = useMemo(() => {
    if (!purgeDate) return ''
    return formatTimestampToDate(purgeDate.getTime(), 'milliseconds')
  }, [purgeDate])

  const formattedMaxPurgeDate = useMemo(
    () => formatTimestampToDate(maxPurgeDate.getTime(), 'milliseconds'),
    [maxPurgeDate]
  )

  const isPurgeDateAllowed =
    !purgeDate || purgeDate.getTime() <= maxPurgeDate.getTime()

  const clampPurgeDate = (date: Date) =>
    date.getTime() > maxPurgeDate.getTime() ? new Date(maxPurgeDate) : date

  const isQuickSelectDisabled = (
    option: (typeof quickSelectOptions)[number]
  ) =>
    boundedRetentionDays > 0 &&
    boundedRetentionDays > option.maxRetentionDays

  const onSubmit = async (values: LogSettingsFormValues) => {
    const updates = Object.entries(values).filter(
      ([key, value]) =>
        value !== defaultValues[key as keyof LogSettingsFormValues]
    )

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value })
    }
    form.reset(values)
  }

  const handleRequestCleanLogs = () => {
    if (!purgeTimestamp) {
      toast.error(t('Select a timestamp before clearing logs.'))
      return
    }
    if (!isPurgeDateAllowed) {
      toast.error(t('Selected timestamp is protected by the retention policy.'))
      return
    }

    setShowConfirmDialog(true)
  }

  const handleCleanLogs = async () => {
    if (!purgeTimestamp) {
      toast.error(t('Select a timestamp before clearing logs.'))
      return
    }
    if (!isPurgeDateAllowed) {
      toast.error(t('Selected timestamp is protected by the retention policy.'))
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
            isSaveDisabled={!form.formState.isDirty}
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
            name='LogRetentionDays'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Usage log retention days')}</FormLabel>
                <FormControl>
                  <div className='flex max-w-xs items-center gap-2'>
                    <Input
                      type='number'
                      min={0}
                      max={MAX_LOG_RETENTION_DAYS}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                    <span className='text-muted-foreground shrink-0 text-sm'>
                      {t('days')}
                    </span>
                  </div>
                </FormControl>
                <FormDescription>
                  {boundedRetentionDays > 0
                    ? t(
                        'Usage logs from the last {{days}} days cannot be deleted.',
                        { days: boundedRetentionDays }
                      )
                    : t(
                        '0 disables retention protection; admins can delete any past usage log.'
                      )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <SettingsControlGroup className='space-y-3'>
            <div>
              <h4 className='text-sm font-medium'>{t('Clean history logs')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Remove all log entries created before the selected timestamp.'
                )}
              </p>
              <p className='text-muted-foreground mt-1 text-xs'>
                {boundedRetentionDays > 0
                  ? t('Current deletion cutoff: {{date}} or earlier.', {
                      date: formattedMaxPurgeDate,
                    })
                  : t(
                      'Retention protection is disabled; future timestamps are still blocked.'
                    )}
              </p>
            </div>
            <DateTimePicker
              value={purgeDate}
              onChange={setPurgeDate}
              maxDate={maxPurgeDate}
            />
            <div className='flex flex-wrap gap-3'>
              {quickSelectOptions.map((option) => (
                <Button
                  key={option.label}
                  type='button'
                  variant='outline'
                  onClick={() =>
                    setPurgeDate(clampPurgeDate(option.getValue()))
                  }
                  disabled={isQuickSelectDisabled(option)}
                >
                  {t(option.label)}
                </Button>
              ))}
              <Button
                type='button'
                variant='destructive'
                onClick={handleRequestCleanLogs}
                disabled={isCleaning || !purgeDate || !isPurgeDateAllowed}
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
              {boundedRetentionDays > 0
                ? t('Usage logs from the last {{days}} days are protected.', {
                    days: boundedRetentionDays,
                  })
                : t('Usage log retention protection is disabled.')}{' '}
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
