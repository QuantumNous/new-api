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
import { useCallback, useEffect, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import dayjs from '@/lib/dayjs'
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
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
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
import { StatusBadge } from '@/components/status-badge'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const perfSchema = z.object({
  'performance_setting.disk_cache_enabled': z.boolean(),
  'performance_setting.disk_cache_threshold_mb': z.coerce.number().min(1),
  'performance_setting.disk_cache_max_size_mb': z.coerce.number().min(100),
  'performance_setting.disk_cache_path': z.string().optional(),
  'performance_setting.monitor_enabled': z.boolean(),
  'performance_setting.monitor_cpu_threshold': z.coerce.number().min(0),
  'performance_setting.monitor_memory_threshold': z.coerce
    .number()
    .min(0)
    .max(100),
  'performance_setting.monitor_disk_threshold': z.coerce
    .number()
    .min(0)
    .max(100),
  'perf_metrics_setting.enabled': z.boolean(),
  'perf_metrics_setting.flush_interval': z.coerce.number().min(1),
  'perf_metrics_setting.bucket_time': z.enum(['minute', '5min', 'hour']),
  'perf_metrics_setting.retention_days': z.coerce.number().min(0),
})

type PerfFormValues = z.infer<typeof perfSchema>

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || isNaN(bytes)) return '0 Bytes'
  if (bytes === 0) return '0 Bytes'
  if (bytes < 0) return '-' + formatBytes(-bytes, decimals)
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
  if (i < 0 || i >= sizes.length) return bytes + ' Bytes'
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

interface Props {
  defaultValues: PerfFormValues
}

type LogInfo = {
  enabled: boolean
  log_dir: string
  file_count: number
  total_size: number
  oldest_time?: string
  newest_time?: string
}

type PerformanceStats = {
  cache_stats?: {
    current_disk_usage_bytes: number
    disk_cache_max_bytes: number
    active_disk_files: number
    disk_cache_hits: number
    current_memory_usage_bytes: number
    active_memory_buffers: number
    memory_cache_hits: number
  }
  disk_space_info?: {
    total: number
    free: number
    used: number
    used_percent: number
  }
  memory_stats?: {
    alloc: number
    total_alloc: number
    sys: number
    num_gc: number
    num_goroutine: number
  }
  disk_cache_info?: {
    path: string
    file_count: number
    total_size: number
  }
  config?: {
    is_running_in_container: boolean
  }
}

export function PerformanceSection(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [logInfo, setLogInfo] = useState<LogInfo | null>(null)
  const [logCleanupMode, setLogCleanupMode] = useState('by_count')
  const [logCleanupValue, setLogCleanupValue] = useState(10)
  const [logCleanupLoading, setLogCleanupLoading] = useState(false)

  const form = useForm<PerfFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(perfSchema) as any,
    defaultValues: props.defaultValues,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useResetForm(form as any, props.defaultValues)

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/performance/stats')
      if (res.data.success) setStats(res.data.data)
    } catch {
      /* ignore */
    }
  }, [])

  const fetchLogInfo = useCallback(async () => {
    try {
      const res = await api.get('/api/performance/logs')
      if (res.data.success) setLogInfo(res.data.data)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchLogInfo()
  }, [fetchStats, fetchLogInfo])

  const onSubmit = async (data: PerfFormValues) => {
    const entries = Object.entries(data) as [string, unknown][]
    const updates = entries.filter(
      ([key, value]) =>
        value !== (props.defaultValues[key as keyof PerfFormValues] as unknown)
    )
    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    for (const [key, value] of updates) {
      await updateOption.mutateAsync({
        key,
        value: value as string | number | boolean,
      })
    }
    toast.success(t('Saved successfully'))
    fetchStats()
  }

  const clearDiskCache = async () => {
    try {
      const res = await api.delete('/api/performance/disk_cache')
      if (res.data.success) {
        toast.success(t('Disk cache cleared'))
        fetchStats()
      }
    } catch {
      toast.error(t('Cleanup failed'))
    }
  }

  const resetStats = async () => {
    try {
      const res = await api.post('/api/performance/reset_stats')
      if (res.data.success) {
        toast.success(t('Statistics reset'))
        fetchStats()
      }
    } catch {
      toast.error(t('Reset failed'))
    }
  }

  const forceGC = async () => {
    try {
      const res = await api.post('/api/performance/gc')
      if (res.data.success) {
        toast.success(t('GC executed'))
        fetchStats()
      }
    } catch {
      toast.error(t('GC execution failed'))
    }
  }

  const cleanupLogFiles = async () => {
    if (!logCleanupValue || isNaN(logCleanupValue) || logCleanupValue < 1) {
      toast.error(t('Please enter a valid number'))
      return
    }
    setLogCleanupLoading(true)
    try {
      const res = await api.delete(
        `/api/performance/logs?mode=${logCleanupMode}&value=${logCleanupValue}`
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
      fetchLogInfo()
    } catch {
      toast.error(t('Cleanup failed'))
    } finally {
      setLogCleanupLoading(false)
    }
  }

  const diskEnabled = form.watch('performance_setting.disk_cache_enabled')
  const monitorEnabled = form.watch('performance_setting.monitor_enabled')
  const perfMetricsEnabled = form.watch('perf_metrics_setting.enabled')
  const maxCacheSizeMb = form.watch(
    'performance_setting.disk_cache_max_size_mb'
  )

  const lowDiskSpace =
    diskEnabled &&
    stats?.disk_space_info &&
    stats.disk_space_info.free > 0 &&
    maxCacheSizeMb > 0 &&
    stats.disk_space_info.free < maxCacheSizeMb * 1024 * 1024

  const diskCachePercent =
    stats?.cache_stats?.disk_cache_max_bytes &&
    stats.cache_stats.disk_cache_max_bytes > 0
      ? Math.round(
          (stats.cache_stats.current_disk_usage_bytes /
            stats.cache_stats.disk_cache_max_bytes) *
            100
        )
      : 0

  return (
    <SettingsSection
      title={t('Performance Settings')}
      description={t(
        'Disk cache, system performance monitoring, and operation statistics'
      )}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          {/* Disk Cache Settings */}
          <div>
            <h4 className='font-medium'>{t('Disk Cache Settings')}</h4>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t(
                'When enabled, large request bodies are temporarily stored on disk instead of memory, significantly reducing memory usage. SSD recommended.'
              )}
            </p>
          </div>

          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <FormField
              control={form.control}
              name='performance_setting.disk_cache_enabled'
              render={({ field }) => (
                <FormItem className='flex items-center gap-2'>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>{t('Enable Disk Cache')}</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='performance_setting.disk_cache_threshold_mb'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Disk Cache Threshold (MB)')}</FormLabel>
                  <FormControl>
                    <Input type='number' {...field} disabled={!diskEnabled} />
                  </FormControl>
                  <FormDescription>
                    {t('Use disk cache when request body exceeds this size')}
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='performance_setting.disk_cache_max_size_mb'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Max Disk Cache Size (MB)')}</FormLabel>
                  <FormControl>
                    <Input type='number' {...field} disabled={!diskEnabled} />
                  </FormControl>
                  {stats?.disk_space_info &&
                    stats.disk_space_info.total > 0 && (
                      <FormDescription>
                        {t('Free: {{free}} / Total: {{total}}', {
                          free: formatBytes(stats.disk_space_info.free),
                          total: formatBytes(stats.disk_space_info.total),
                        })}
                      </FormDescription>
                    )}
                </FormItem>
              )}
            />
          </div>

          {lowDiskSpace && (
            <Alert variant='destructive'>
              <AlertDescription>
                {`${t('Warning')}: ${t('Available disk space')} (${formatBytes(stats?.disk_space_info?.free ?? 0)}) ${t('is less than the configured maximum cache size')} (${maxCacheSizeMb} MB). ${t('This may cause cache failures.')}`}
              </AlertDescription>
            </Alert>
          )}

          {!stats?.config?.is_running_in_container && (
            <FormField
              control={form.control}
              name='performance_setting.disk_cache_path'
              render={({ field }) => (
                <FormItem className='max-w-md'>
                  <FormLabel>{t('Cache Directory')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t(
                        'Leave empty to use system temp directory'
                      )}
                      {...field}
                      value={field.value ?? ''}
                      disabled={!diskEnabled}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          <Separator />

          {/* System Performance Monitor */}
          <div>
            <h4 className='font-medium'>
              {t('System Performance Monitoring')}
            </h4>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t(
                'When performance monitoring is enabled and system resource usage exceeds the set threshold, new Relay requests will be rejected.'
              )}
            </p>
          </div>

          <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
            <FormField
              control={form.control}
              name='performance_setting.monitor_enabled'
              render={({ field }) => (
                <FormItem className='flex items-center gap-2'>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>{t('Enable Performance Monitoring')}</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='performance_setting.monitor_cpu_threshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('CPU Threshold (%)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      {...field}
                      disabled={!monitorEnabled}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='performance_setting.monitor_memory_threshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Memory Threshold (%)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      {...field}
                      disabled={!monitorEnabled}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='performance_setting.monitor_disk_threshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Disk Threshold (%)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      {...field}
                      disabled={!monitorEnabled}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <Separator />

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
                <FormItem className='flex items-center gap-2'>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel>{t('Enable model performance metrics')}</FormLabel>
                </FormItem>
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
                      {...field}
                      disabled={!perfMetricsEnabled}
                    />
                  </FormControl>
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
                      {...field}
                      disabled={!perfMetricsEnabled}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('0 means data is kept permanently')}
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? t('Saving...') : t('Save Changes')}
          </Button>
        </form>
      </Form>

      <Separator />

      {/* Server Log Management */}
      <div className='space-y-4'>
        <div>
          <h4 className='font-medium'>{t('Server Log Management')}</h4>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t(
              'Manage server log files. Log files accumulate over time; regular cleanup is recommended to free disk space.'
            )}
          </p>
        </div>

        {logInfo === null ? null : logInfo.enabled ? (
          <div className='space-y-4'>
            <div className='rounded-lg border p-4'>
              <div className='grid grid-cols-2 gap-2 text-sm md:grid-cols-4'>
                <div>
                  <span className='text-muted-foreground'>
                    {t('Log Directory')}:
                  </span>{' '}
                  <span className='font-mono text-xs'>{logInfo.log_dir}</span>
                </div>
                <div>
                  <span className='text-muted-foreground'>
                    {t('Log File Count')}:
                  </span>{' '}
                  {logInfo.file_count}
                </div>
                <div>
                  <span className='text-muted-foreground'>
                    {t('Total Log Size')}:
                  </span>{' '}
                  {formatBytes(logInfo.total_size)}
                </div>
                {logInfo.oldest_time && logInfo.newest_time && (
                  <div>
                    <span className='text-muted-foreground'>
                      {t('Date Range')}:
                    </span>{' '}
                    {dayjs(logInfo.oldest_time).format('YYYY-MM-DD')} ~{' '}
                    {dayjs(logInfo.newest_time).format('YYYY-MM-DD')}
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
                  value={logCleanupMode}
                  onValueChange={(v) => v !== null && setLogCleanupMode(v)}
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
                  {logCleanupMode === 'by_count'
                    ? t('Files to Retain')
                    : t('Days to Retain')}
                </Label>
                <Input
                  type='number'
                  min={1}
                  max={logCleanupMode === 'by_count' ? 1000 : 3650}
                  value={logCleanupValue}
                  onChange={(e) => setLogCleanupValue(Number(e.target.value))}
                  className='w-[120px]'
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant='destructive'
                      size='sm'
                      disabled={logCleanupLoading}
                    />
                  }
                >
                  {logCleanupLoading
                    ? t('Cleaning...')
                    : t('Clean Up Log Files')}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('Confirm log file cleanup?')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {logCleanupMode === 'by_count'
                        ? t(
                            'Only the last {{value}} log files will be retained; the rest will be deleted.',
                            {
                              value: logCleanupValue,
                            }
                          )
                        : t(
                            'Log files older than {{value}} days will be deleted.',
                            {
                              value: logCleanupValue,
                            }
                          )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={cleanupLogFiles}>
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
        )}
      </div>

      <Separator />

      {/* Performance Stats Dashboard */}
      <div className='space-y-4'>
        <div className='flex items-center gap-2'>
          <h4 className='font-medium'>{t('Performance Monitor')}</h4>
          <Button variant='outline' size='sm' onClick={fetchStats}>
            {t('Refresh Stats')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant='outline' size='sm' />}>
              {t('Clean up inactive cache')}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('Confirm cleanup of inactive disk cache?')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t(
                    'This will delete temporary cache files that have not been used for more than 10 minutes'
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={clearDiskCache}>
                  {t('Confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant='outline' size='sm' onClick={resetStats}>
            {t('Reset Stats')}
          </Button>
          <Button variant='outline' size='sm' onClick={forceGC}>
            {t('Run GC')}
          </Button>
        </div>

        {stats && (
          <>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div className='space-y-2 rounded-lg border p-4'>
                <p className='text-sm font-medium'>
                  {t('Request Body Disk Cache')}
                </p>
                <Progress value={diskCachePercent} />
                <div className='text-muted-foreground flex justify-between text-xs'>
                  <span>
                    {formatBytes(
                      stats.cache_stats?.current_disk_usage_bytes ?? 0
                    )}{' '}
                    /{' '}
                    {formatBytes(stats.cache_stats?.disk_cache_max_bytes ?? 0)}
                  </span>
                  <span>
                    {t('Active Files')}:{' '}
                    {stats.cache_stats?.active_disk_files ?? 0}
                  </span>
                </div>
                <StatusBadge variant='neutral' copyable={false}>
                  {t('Disk Hits')}: {stats.cache_stats?.disk_cache_hits ?? 0}
                </StatusBadge>
              </div>
              <div className='space-y-2 rounded-lg border p-4'>
                <p className='text-sm font-medium'>
                  {t('Request Body Memory Cache')}
                </p>
                <div className='text-muted-foreground flex justify-between text-xs'>
                  <span>
                    {t('Current Cache Size')}:{' '}
                    {formatBytes(
                      stats.cache_stats?.current_memory_usage_bytes ?? 0
                    )}
                  </span>
                  <span>
                    {t('Active Cache Count')}:{' '}
                    {stats.cache_stats?.active_memory_buffers ?? 0}
                  </span>
                </div>
                <StatusBadge variant='neutral' copyable={false}>
                  {t('Memory Hits')}:{' '}
                  {stats.cache_stats?.memory_cache_hits ?? 0}
                </StatusBadge>
              </div>
            </div>

            {stats.disk_space_info && stats.disk_space_info.total > 0 && (
              <div className='rounded-lg border p-4'>
                <p className='mb-2 text-sm font-medium'>
                  {t('Cache Directory Disk Space')}
                </p>
                <Progress
                  value={Math.round(stats.disk_space_info.used_percent)}
                />
                <div className='text-muted-foreground mt-2 flex justify-between text-xs'>
                  <span>
                    {t('Used')}: {formatBytes(stats.disk_space_info.used)}
                  </span>
                  <span>
                    {t('Available')}: {formatBytes(stats.disk_space_info.free)}
                  </span>
                  <span>
                    {t('Total')}: {formatBytes(stats.disk_space_info.total)}
                  </span>
                </div>
              </div>
            )}

            {stats.memory_stats && (
              <div className='rounded-lg border p-4'>
                <p className='mb-2 text-sm font-medium'>
                  {t('System Memory Stats')}
                </p>
                <div className='grid grid-cols-2 gap-2 text-xs md:grid-cols-5'>
                  <div>
                    <span className='text-muted-foreground'>
                      {t('Allocated Memory')}:
                    </span>{' '}
                    {formatBytes(stats.memory_stats.alloc)}
                  </div>
                  <div>
                    <span className='text-muted-foreground'>
                      {t('Total Allocated')}:
                    </span>{' '}
                    {formatBytes(stats.memory_stats.total_alloc)}
                  </div>
                  <div>
                    <span className='text-muted-foreground'>
                      {t('System Memory')}:
                    </span>{' '}
                    {formatBytes(stats.memory_stats.sys)}
                  </div>
                  <div>
                    <span className='text-muted-foreground'>
                      {t('GC Count')}:
                    </span>{' '}
                    {stats.memory_stats.num_gc}
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Goroutines:</span>{' '}
                    {stats.memory_stats.num_goroutine}
                  </div>
                </div>
              </div>
            )}

            {stats.disk_cache_info && (
              <div className='rounded-lg border p-4'>
                <p className='mb-2 text-sm font-medium'>
                  {t('Cache Directory Info')}
                </p>
                <div className='grid grid-cols-3 gap-2 text-xs'>
                  <div>
                    <span className='text-muted-foreground'>
                      {t('Cache Directory')}:
                    </span>{' '}
                    <span className='font-mono'>
                      {stats.disk_cache_info.path}
                    </span>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>
                      {t('Directory File Count')}:
                    </span>{' '}
                    {stats.disk_cache_info.file_count}
                  </div>
                  <div>
                    <span className='text-muted-foreground'>
                      {t('Directory Total Size')}:
                    </span>{' '}
                    {formatBytes(stats.disk_cache_info.total_size)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </SettingsSection>
  )
}
