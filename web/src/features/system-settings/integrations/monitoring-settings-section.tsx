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
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { safeNumberFieldProps } from '../utils/numeric-field'

const numericString = z.string().refine((value) => {
  const trimmed = value.trim()
  if (!trimmed) return true
  return !Number.isNaN(Number(trimmed)) && Number(trimmed) >= 0
}, 'Enter a non-negative number or leave empty')

const monitoringSchema = z.object({
  QuotaRemindThreshold: numericString,
  perf_metrics_setting: z.object({
    enabled: z.boolean(),
    flush_interval: z.coerce.number().min(1),
    bucket_time: z.enum(['minute', '5min', 'hour']),
    retention_days: z.coerce.number().min(0),
  }),
  CacheRateStatsEnabled: z.boolean(),
  CacheRateUserVisibleEnabled: z.boolean(),
})

type MonitoringFormInput = z.input<typeof monitoringSchema>
type MonitoringFormValues = z.output<typeof monitoringSchema>

type FlatMonitoringDefaults = {
  QuotaRemindThreshold: string
  'perf_metrics_setting.enabled': boolean
  'perf_metrics_setting.flush_interval': number
  'perf_metrics_setting.bucket_time': 'minute' | '5min' | 'hour'
  'perf_metrics_setting.retention_days': number
  CacheRateStatsEnabled: boolean
  CacheRateUserVisibleEnabled: boolean
}

type MonitoringSettingsSectionProps = {
  defaultValues: FlatMonitoringDefaults
}

const buildFormDefaults = (
  defaults: MonitoringSettingsSectionProps['defaultValues']
): MonitoringFormInput => ({
  QuotaRemindThreshold: defaults.QuotaRemindThreshold ?? '',
  perf_metrics_setting: {
    enabled: defaults['perf_metrics_setting.enabled'],
    flush_interval: defaults['perf_metrics_setting.flush_interval'],
    bucket_time: defaults['perf_metrics_setting.bucket_time'],
    retention_days: defaults['perf_metrics_setting.retention_days'],
  },
  CacheRateStatsEnabled: defaults.CacheRateStatsEnabled,
  CacheRateUserVisibleEnabled: defaults.CacheRateUserVisibleEnabled,
})

const normalizeDefaults = (
  defaults: MonitoringSettingsSectionProps['defaultValues']
): FlatMonitoringDefaults => ({
  QuotaRemindThreshold: (defaults.QuotaRemindThreshold ?? '').trim(),
  'perf_metrics_setting.enabled': defaults['perf_metrics_setting.enabled'],
  'perf_metrics_setting.flush_interval':
    defaults['perf_metrics_setting.flush_interval'],
  'perf_metrics_setting.bucket_time':
    defaults['perf_metrics_setting.bucket_time'],
  'perf_metrics_setting.retention_days':
    defaults['perf_metrics_setting.retention_days'],
  CacheRateStatsEnabled: defaults.CacheRateStatsEnabled,
  CacheRateUserVisibleEnabled: defaults.CacheRateUserVisibleEnabled,
})

const normalizeFormValues = (
  values: MonitoringFormValues
): FlatMonitoringDefaults => ({
  QuotaRemindThreshold: values.QuotaRemindThreshold.trim(),
  'perf_metrics_setting.enabled': values.perf_metrics_setting.enabled,
  'perf_metrics_setting.flush_interval':
    values.perf_metrics_setting.flush_interval,
  'perf_metrics_setting.bucket_time': values.perf_metrics_setting.bucket_time,
  'perf_metrics_setting.retention_days':
    values.perf_metrics_setting.retention_days,
  CacheRateStatsEnabled: values.CacheRateStatsEnabled,
  CacheRateUserVisibleEnabled: values.CacheRateUserVisibleEnabled,
})

export function MonitoringSettingsSection({
  defaultValues,
}: MonitoringSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  // Flat per-field locals: the reset effect's dependency array must consist
  // of simple identifiers, and the parent registry rebuilds the defaults
  // object on every render, so depending on the object identity would reset
  // away unsaved edits.
  const {
    QuotaRemindThreshold: quotaRemindThreshold,
    'perf_metrics_setting.enabled': perfMetricsEnabledDefault,
    'perf_metrics_setting.flush_interval': perfMetricsFlushIntervalDefault,
    'perf_metrics_setting.bucket_time': perfMetricsBucketTimeDefault,
    'perf_metrics_setting.retention_days': perfMetricsRetentionDaysDefault,
    CacheRateStatsEnabled: cacheRateStatsEnabledDefault,
    CacheRateUserVisibleEnabled: cacheRateUserVisibleEnabledDefault,
  } = defaultValues

  // Last values known to be persisted on the server. defaultValues comes from
  // a query and can lag behind our own successful saves; comparing against it
  // would silently drop a reversal saved inside that window. Own a copy and
  // replace it immutably so the caller's defaults object is never mutated.
  const lastSavedRef = useRef<FlatMonitoringDefaults>(
    normalizeDefaults(defaultValues)
  )

  const form = useForm<MonitoringFormInput, unknown, MonitoringFormValues>({
    resolver: zodResolver(monitoringSchema),
    defaultValues: buildFormDefaults(defaultValues),
  })

  // Skip the reset when the refresh only echoes values we already saved, so
  // edits made while the query refetch was in flight survive.
  useEffect(() => {
    const next = normalizeDefaults({
      QuotaRemindThreshold: quotaRemindThreshold,
      'perf_metrics_setting.enabled': perfMetricsEnabledDefault,
      'perf_metrics_setting.flush_interval': perfMetricsFlushIntervalDefault,
      'perf_metrics_setting.bucket_time': perfMetricsBucketTimeDefault,
      'perf_metrics_setting.retention_days': perfMetricsRetentionDaysDefault,
      CacheRateStatsEnabled: cacheRateStatsEnabledDefault,
      CacheRateUserVisibleEnabled: cacheRateUserVisibleEnabledDefault,
    })
    if (JSON.stringify(next) === JSON.stringify(lastSavedRef.current)) {
      return
    }
    lastSavedRef.current = next
    form.reset(buildFormDefaults(next))
  }, [
    quotaRemindThreshold,
    perfMetricsEnabledDefault,
    perfMetricsFlushIntervalDefault,
    perfMetricsBucketTimeDefault,
    perfMetricsRetentionDaysDefault,
    cacheRateStatsEnabledDefault,
    cacheRateUserVisibleEnabledDefault,
    form,
  ])

  const perfMetricsEnabled = form.watch('perf_metrics_setting.enabled')
  const cacheRateStatsEnabled = form.watch('CacheRateStatsEnabled')

  const onSubmit = async (values: MonitoringFormValues) => {
    const normalized = normalizeFormValues(values)
    const updates = (
      Object.keys(normalized) as Array<keyof FlatMonitoringDefaults>
    ).filter((key) => normalized[key] !== lastSavedRef.current[key])

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of updates) {
      try {
        await updateOption.mutateAsync({
          key,
          value: normalized[key],
        })
      } catch {
        // The mutation's onError already reports the failure; stop applying
        // the remaining options so they keep their last saved values.
        return
      }
      // Union-keyed writes need the widened record view; `saved` itself keeps
      // the FlatMonitoringDefaults shape.
      const saved = { ...lastSavedRef.current }
      const writable = saved as Record<
        keyof FlatMonitoringDefaults,
        string | number | boolean
      >
      writable[key] = normalized[key]
      lastSavedRef.current = saved
    }
  }

  return (
    <SettingsSection title={t('Monitoring & Alerts')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormField
            control={form.control}
            name='QuotaRemindThreshold'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Quota reminder (tokens)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    step={1}
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Send email alerts when a user falls below this quota')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <h4 className='font-medium'>{t('Model performance metrics')}</h4>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t(
                'Collect relay latency and success-rate metrics for the model square.'
              )}
            </p>
          </div>

          <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
            <FormField
              control={form.control}
              name='perf_metrics_setting.enabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>
                      {t('Enable model performance metrics')}
                    </FormLabel>
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
              name='perf_metrics_setting.flush_interval'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Flush interval (minutes)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      step={1}
                      {...safeNumberFieldProps(field)}
                      disabled={!perfMetricsEnabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='perf_metrics_setting.bucket_time'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Aggregation bucket')}</FormLabel>
                  <Select
                    items={[
                      { value: 'minute', label: t('1 minute') },
                      { value: '5min', label: t('5 minutes') },
                      { value: 'hour', label: t('1 hour') },
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!perfMetricsEnabled}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='minute'>{t('1 minute')}</SelectItem>
                        <SelectItem value='5min'>{t('5 minutes')}</SelectItem>
                        <SelectItem value='hour'>{t('1 hour')}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='perf_metrics_setting.retention_days'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Retention days')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step={1}
                      {...safeNumberFieldProps(field)}
                      disabled={!perfMetricsEnabled}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('0 means data is kept permanently')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div>
            <h4 className='font-medium'>{t('Cache rate statistics')}</h4>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t(
                'Cache read/creation rates and request-count hit rates in usage logs, the data dashboard, and the model square.'
              )}
            </p>
          </div>

          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='CacheRateStatsEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>
                      {t('Enable cache rate statistics')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'Show cache read and creation rates in usage logs and the data dashboard.'
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
              name='CacheRateUserVisibleEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>
                      {t('Allow regular users to view cache statistics')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'When disabled, cache token usage is hidden from regular users in their own logs and dashboard.'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!cacheRateStatsEnabled}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
