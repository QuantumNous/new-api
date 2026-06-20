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
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import dayjs from '@/lib/dayjs'
import { formatTimestampToDate } from '@/lib/format'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
})

type LogSettingsFormValues = z.infer<typeof logSettingsSchema>

type LogSettingsSectionProps = {
  defaultEnabled: boolean
}

type ServerLogInfo = {
  enabled: boolean
  log_dir: string
  file_count: number
  total_size: number
  oldest_time?: string
  newest_time?: string
}

const HOURS_IN_DAY = 24

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || Number.isNaN(bytes)) return '0 Bytes'
  if (bytes === 0) return '0 Bytes'
  if (bytes < 0) return `-${formatBytes(-bytes, decimals)}`
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
  if (i < 0 || i >= sizes.length) return `${bytes} Bytes`
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${
    sizes[i]
  }`
}

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
}: LogSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<LogSettingsFormValues>({
    resolver: zodResolver(logSettingsSchema),
    defaultValues: {
      LogConsumeEnabled: defaultEnabled,
    },
  })

  const [purgeDate, setPurgeDate] = useState<Date | undefined>(() =>
    getDateDaysAgo(30)
  )
  const [isCleaning, setIsCleaning] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [serverLogInfo, setServerLogInfo] = useState<ServerLogInfo | null>(
    null
  )
  const [serverLogCleanupMode, setServerLogCleanupMode] = useState('by_count')
  const [serverLogCleanupValue, setServerLogCleanupValue] = useState(10)
  const [serverLogCleanupLoading, setServerLogCleanupLoading] = useState(false)

  const fetchServerLogInfo = useCallback(async () => {
    try {
      const res = await api.get('/api/performance/logs')
      if (res.data.success) setServerLogInfo(res.data.data)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    form.reset({ LogConsumeEnabled: defaultEnabled })
  }, [defaultEnabled, form])

  useEffect(() => {
    fetchServerLogInfo()
  }, [fetchServerLogInfo])

  const purgeTimestamp = useMemo(() => {
    if (!purgeDate) return null
    return Math.floor(purgeDate.getTime() / 1000)
  }, [purgeDate])

  const formattedPurgeDate = useMemo(() => {
    if (!purgeDate) return ''
    return formatTimestampToDate(purgeDate.getTime(), 'milliseconds')
  }, [purgeDate])

  const onSubmit = async (values: LogSettingsFormValues) => {
    if (values.LogConsumeEnabled === defaultEnabled) return
    await updateOption.mutateAsync({
      key: 'LogConsumeEnabled',
      value: values.LogConsumeEnabled,
    })
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

  const cleanupServerLogFiles = async () => {
    if (
      !serverLogCleanupValue ||
      Number.isNaN(serverLogCleanupValue) ||
      serverLogCleanupValue < 1
    ) {
      toast.error(t('Please enter a valid number'))
      return
    }

    setServerLogCleanupLoading(true)
    try {
      const res = await api.delete(
        `/api/performance/logs?mode=${serverLogCleanupMode}&value=${serverLogCleanupValue}`
      )
      if (res.data.success) {
        const { deleted_count, freed_bytes } = res.data.data
        toast.success(
          t('Cleaned up {{count}} log files, freed {{size}}', {
            count: deleted_count,
            size: formatBytes(freed_bytes),
          })
        )
      } else {
        toast.error(res.data.message || t('Cleanup failed'))
      }
      fetchServerLogInfo()
    } catch {
      toast.error(t('Cleanup failed'))
    } finally {
      setServerLogCleanupLoading(false)
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

      <Separator />

      <div className='space-y-4'>
        <div>
          <h4 className='font-medium'>{t('Server Log Management')}</h4>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t(
              'Manage server log files. Log files accumulate over time; regular cleanup is recommended to free disk space.'
            )}
          </p>
        </div>

        {serverLogInfo !== null &&
          (serverLogInfo.enabled ? (
            <div className='space-y-4'>
              <div className='rounded-lg border p-4'>
                <div className='grid grid-cols-2 gap-2 text-sm md:grid-cols-4'>
                  <div>
                    <span className='text-muted-foreground'>
                      {t('Log Directory')}:
                    </span>{' '}
                    <span className='font-mono text-xs'>
                      {serverLogInfo.log_dir}
                    </span>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>
                      {t('Log File Count')}:
                    </span>{' '}
                    {serverLogInfo.file_count}
                  </div>
                  <div>
                    <span className='text-muted-foreground'>
                      {t('Total Log Size')}:
                    </span>{' '}
                    {formatBytes(serverLogInfo.total_size)}
                  </div>
                  {serverLogInfo.oldest_time && serverLogInfo.newest_time && (
                    <div>
                      <span className='text-muted-foreground'>
                        {t('Date Range')}:
                      </span>{' '}
                      {dayjs(serverLogInfo.oldest_time).format('YYYY-MM-DD')} ~{' '}
                      {dayjs(serverLogInfo.newest_time).format('YYYY-MM-DD')}
                    </div>
                  )}
                </div>
              </div>

              <div className='flex flex-wrap items-end gap-3'>
                <div className='grid gap-1.5'>
                  <Label className='text-xs'>{t('Cleanup Mode')}</Label>
                  <Select
                    items={[
                      { value: 'by_count', label: t('Retain last N files') },
                      { value: 'by_days', label: t('Retain last N days') },
                    ]}
                    value={serverLogCleanupMode}
                    onValueChange={(value) =>
                      value !== null && setServerLogCleanupMode(value)
                    }
                  >
                    <SelectTrigger className='w-[160px]'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='by_count'>
                          {t('Retain last N files')}
                        </SelectItem>
                        <SelectItem value='by_days'>
                          {t('Retain last N days')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className='grid gap-1.5'>
                  <Label className='text-xs'>
                    {serverLogCleanupMode === 'by_count'
                      ? t('Files to Retain')
                      : t('Days to Retain')}
                  </Label>
                  <Input
                    type='number'
                    min={1}
                    max={serverLogCleanupMode === 'by_count' ? 1000 : 3650}
                    value={serverLogCleanupValue}
                    onChange={(event) =>
                      setServerLogCleanupValue(Number(event.target.value))
                    }
                    className='w-[120px]'
                  />
                </div>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        type='button'
                        variant='destructive'
                        size='sm'
                        disabled={serverLogCleanupLoading}
                      />
                    }
                  >
                    {serverLogCleanupLoading
                      ? t('Cleaning...')
                      : t('Clean Up Log Files')}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t('Confirm log file cleanup?')}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {serverLogCleanupMode === 'by_count'
                          ? t(
                              'Only the last {{value}} log files will be retained; the rest will be deleted.',
                              {
                                value: serverLogCleanupValue,
                              }
                            )
                          : t(
                              'Log files older than {{value}} days will be deleted.',
                              {
                                value: serverLogCleanupValue,
                              }
                            )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={cleanupServerLogFiles}>
                        {t('Confirm Cleanup')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                {t(
                  'Server logging is not enabled (log directory not configured)'
                )}
              </AlertDescription>
            </Alert>
          ))}
      </div>

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
