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
import { useCallback, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import { api } from '@/lib/api'
import dayjs from '@/lib/dayjs'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

type ServerLogInfo = {
  enabled: boolean
  log_dir: string
  file_count: number
  total_size: number
  oldest_time?: string
  newest_time?: string
}

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

/**
 * The server log module of the log maintenance page. It shows the log files
 * the server writes to disk and deletes old ones.
 */
export function ServerLogFiles() {
  const { t } = useTranslation()
  const titleId = useId()
  const [serverLogInfo, setServerLogInfo] = useState<ServerLogInfo | null>(null)
  const [serverLogCleanupMode, setServerLogCleanupMode] = useState('by_count')
  const [serverLogCleanupValue, setServerLogCleanupValue] = useState(10)
  const [serverLogCleanupLoading, setServerLogCleanupLoading] = useState(false)

  const fetchServerLogInfo = useCallback(async () => {
    try {
      const res = await api.get('/api/performance/logs')
      requireServerSuccess(res.data)
      if (res.data.success) setServerLogInfo(res.data.data)
    } catch (error) {
      handleServerError(error)
    }
  }, [])

  useEffect(() => {
    fetchServerLogInfo()
  }, [fetchServerLogInfo])

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
        handleServerError(res.data, t('Cleanup failed'))
      }
      fetchServerLogInfo()
    } catch (error) {
      handleServerError(error, t('Cleanup failed'))
    } finally {
      setServerLogCleanupLoading(false)
    }
  }

  return (
    <div
      role='group'
      aria-labelledby={titleId}
      className='flex min-w-0 flex-col gap-4'
    >
      <div>
        <h4 id={titleId} className='font-medium'>
          {t('Server Log Management')}
        </h4>
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
                    <AlertDialogAction
                      variant='destructive'
                      onClick={cleanupServerLogFiles}
                    >
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
  )
}
