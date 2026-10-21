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
import { getRouteApi } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import dayjs from '@/lib/dayjs'
import { handleServerError } from '@/lib/handle-server-error'

import { exportLogs } from '../../api'
import {
  downloadCsv,
  getLogCsvHeader,
  getLogCsvRow,
  toCsvLine,
} from '../../lib/export'
import { buildApiParams, getDefaultTimeRange } from '../../lib/utils'
import { CompactDateTimeRangePicker } from '../compact-date-time-range-picker'
import { useLogsViewScope } from '../usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_MAX_RANGE_DAYS = 365

/**
 * Export button for the common logs page. It asks for the time range, then
 * downloads the logs of the current view with the page's other filters as a
 * CSV file. Administrators in the all-users view export every user's logs.
 */
export function ExportLogsDialog() {
  const { t } = useTranslation()
  const searchParams = route.useSearch()
  const { canManageScope, isAdminView } = useLogsViewScope()
  const { status } = useStatus()
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<{ start?: Date; end?: Date }>({})
  const [exportedCount, setExportedCount] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  if (!canManageScope && status?.log_export_enabled === false) return null

  const maxDays = status?.log_max_range_days || DEFAULT_MAX_RANGE_DAYS
  const startMs = range.start?.getTime()
  const endMs = range.end?.getTime()
  let rangeError: string | null = null
  if (startMs !== undefined && endMs !== undefined) {
    if (endMs < startMs) {
      rangeError = t('End time must be after start time')
    } else if (Math.min(endMs, Date.now()) - startMs > maxDays * DAY_MS) {
      rangeError = t('The time range cannot exceed {{days}} days', {
        days: maxDays,
      })
    }
  }
  const exporting = exportedCount !== null
  const canExport =
    startMs !== undefined && endMs !== undefined && !rangeError && !exporting

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const defaults = getDefaultTimeRange()
      setRange({
        start: searchParams.startTime
          ? new Date(searchParams.startTime)
          : defaults.start,
        end: searchParams.endTime
          ? new Date(searchParams.endTime)
          : defaults.end,
      })
    } else {
      abortRef.current?.abort()
    }
    setOpen(nextOpen)
  }

  const handleExport = async () => {
    if (!range.start || !range.end) return
    const controller = new AbortController()
    abortRef.current = controller
    const lines = [toCsvLine(getLogCsvHeader(isAdminView, t))]
    setExportedCount(0)
    try {
      const count = await exportLogs(
        {
          ...buildApiParams({
            page: 1,
            pageSize: 1,
            searchParams,
            isAdmin: isAdminView,
          }),
          p: undefined,
          page_size: undefined,
          start_timestamp: Math.floor(range.start.getTime() / 1000),
          end_timestamp: Math.floor(range.end.getTime() / 1000),
        },
        isAdminView,
        {
          signal: controller.signal,
          onLog: (log) => {
            lines.push(toCsvLine(getLogCsvRow(log, isAdminView, t)))
            if (lines.length % 500 === 0) setExportedCount(lines.length - 1)
          },
        }
      )
      downloadCsv(
        `usage-logs-${dayjs(range.start).format('YYYYMMDD')}-${dayjs(range.end).format('YYYYMMDD')}.csv`,
        lines
      )
      toast.success(t('Exported {{count}} logs', { count }))
      setOpen(false)
    } catch (error) {
      handleServerError(error, t('Failed to export logs'))
    } finally {
      abortRef.current = null
      setExportedCount(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button type='button' variant='outline'>
          {t('Export')}
        </Button>
      }
      title={t('Export logs')}
      description={t(
        'Choose a time range of up to {{days}} days. The other filters on this page also apply.',
        { days: maxDays }
      )}
      contentClassName='sm:max-w-md'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            onClick={handleExport}
            disabled={!canExport}
            aria-busy={exporting}
          >
            {exporting && <Loader2 className='animate-spin' />}
            {t('Export')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <CompactDateTimeRangePicker
          start={range.start}
          end={range.end}
          onChange={setRange}
        />
        {rangeError && (
          <p role='alert' className='text-destructive text-sm'>
            {rangeError}
          </p>
        )}
        {exporting && (
          <p aria-live='polite' className='text-muted-foreground text-sm'>
            {t('Exported {{count}} logs', { count: exportedCount })}
          </p>
        )}
      </div>
    </Dialog>
  )
}
