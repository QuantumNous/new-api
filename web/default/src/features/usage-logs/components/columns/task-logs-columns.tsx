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
/* eslint-disable react-refresh/only-export-components */
import { useState, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { AudioLines } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { TASK_ACTIONS, TASK_STATUS } from '../../constants'
import { taskActionMapper, taskStatusMapper } from '../../lib/mappers'
import {
  usageLogsColumnHeaderClassName,
  usageLogsDetailSummaryClass,
  usageLogsInlinePillClass,
  usageLogsTableClickableLinkClass,
  usageLogsTableEmptyClass,
  usageLogsTableFailReasonClass,
  usageLogsTableMetaClass,
  usageLogsTablePrimaryClass,
} from '../../lib/ops-ui-styles'
import type { TaskLog } from '../../types'
import {
  AudioPreviewDialog,
  type AudioClip,
} from '../dialogs/audio-preview-dialog'
import { FailReasonDialog } from '../dialogs/fail-reason-dialog'
import { useUsageLogsContext } from '../usage-logs-provider'
import {
  createDurationColumn,
  createChannelColumn,
  createProgressColumn,
} from './column-helpers'

function parseTaskData(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function AudioPreviewCell({ log }: { log: TaskLog }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const clips = useMemo(() => {
    const data = parseTaskData(log.data)
    return data.filter(
      (c) =>
        c && typeof c === 'object' && (c as Record<string, unknown>).audio_url
    )
  }, [log.data])

  if (clips.length === 0) return null

  return (
    <>
      <button
        type='button'
        className='group flex items-center gap-1.5 text-left'
        onClick={() => setOpen(true)}
      >
        <AudioLines
          className='size-3.5 shrink-0 text-slate-400 group-hover:text-cyan-300'
          aria-hidden
        />
        <span
          className={cn(
            usageLogsDetailSummaryClass,
            'group-hover:text-cyan-200 group-hover:underline'
          )}
        >
          {t('Click to preview audio')}
        </span>
      </button>
      <AudioPreviewDialog
        open={open}
        onOpenChange={setOpen}
        clips={clips as AudioClip[]}
      />
    </>
  )
}

export function useTaskLogsColumns(isAdmin: boolean): ColumnDef<TaskLog>[] {
  const { t } = useTranslation()
  const columns: ColumnDef<TaskLog>[] = [
    {
      accessorKey: 'submit_time',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('Submit Time')}
          className={usageLogsColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => {
        const log = row.original
        const submitTime = row.getValue('submit_time') as number

        return (
          <div className='flex flex-col gap-0.5'>
            <span
              className={cn(
                'font-mono text-xs tabular-nums',
                usageLogsTablePrimaryClass
              )}
            >
              {formatTimestampToDate(submitTime, 'seconds')}
            </span>
            {log.finish_time ? (
              <span
                className={cn(
                  'font-mono text-[11px] tabular-nums',
                  usageLogsTableMetaClass
                )}
              >
                {formatTimestampToDate(log.finish_time, 'seconds')}
              </span>
            ) : (
              <span className={usageLogsTableEmptyClass}>-</span>
            )}
          </div>
        )
      },
      meta: { label: t('Submit Time') },
    },
  ]

  if (isAdmin) {
    columns.push(
      createChannelColumn<TaskLog>({ headerLabel: t('usageLogs.col.channel') }),
      {
        id: 'user',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('usageLogs.col.account')}
            className={usageLogsColumnHeaderClassName}
          />
        ),
        cell: function UserCell({ row }) {
          const { sensitiveVisible, setSelectedUserId, setUserInfoDialogOpen } =
            useUsageLogsContext()
          const log = row.original
          const displayName = log.username || String(log.user_id || '?')

          return (
            <button
              type='button'
              className='flex items-center gap-1.5 text-left'
              aria-label={t('usageLogs.userDialog.view_account')}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedUserId(log.user_id)
                setUserInfoDialogOpen(true)
              }}
            >
              <Avatar className='size-6 ring-1 ring-white/15'>
                <AvatarFallback
                  className={cn(
                    'text-[11px] font-semibold',
                    !sensitiveVisible && 'bg-white/10 text-slate-400'
                  )}
                  style={
                    sensitiveVisible
                      ? getUserAvatarStyle(displayName)
                      : undefined
                  }
                >
                  {sensitiveVisible ? getUserAvatarFallback(displayName) : '•'}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  'max-w-[100px] truncate text-sm font-semibold hover:underline',
                  usageLogsTablePrimaryClass
                )}
              >
                {sensitiveVisible ? displayName : '••••'}
              </span>
            </button>
          )
        },
        meta: { label: t('usageLogs.col.account'), mobileHidden: true },
      }
    )
  }

  columns.push(
    {
      accessorKey: 'task_id',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('Task ID')}
          className={usageLogsColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => {
        const log = row.original
        const taskId = row.getValue('task_id') as string
        if (!taskId) {
          return <span className={usageLogsTableEmptyClass}>-</span>
        }
        return (
          <div className='flex max-w-[170px] flex-col gap-0.5'>
            <StatusBadge
              label={taskId}
              autoColor={taskId}
              size='sm'
              showDot={false}
              className={cn(
                usageLogsInlinePillClass,
                'max-w-full truncate font-mono'
              )}
            />
            <span className={cn('truncate', usageLogsTableMetaClass)}>
              {t(log.platform)} · {t(taskActionMapper.getLabel(log.action))}
            </span>
          </div>
        )
      },
      meta: { label: t('Task ID'), mobileTitle: true },
    },
    createDurationColumn<TaskLog>({
      submitTimeKey: 'submit_time',
      finishTimeKey: 'finish_time',
      unit: 'seconds',
      headerLabel: t('Duration'),
      warningThresholdSec: 300,
    }),
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('Status')}
          className={usageLogsColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        return (
          <StatusBadge
            label={t(taskStatusMapper.getLabel(status, status || 'Submitting'))}
            variant={taskStatusMapper.getVariant(status)}
            size='sm'
            copyable={false}
            showDot
          />
        )
      },
      meta: { label: t('Status') },
    },
    createProgressColumn<TaskLog>({ headerLabel: t('Progress') }),
    {
      accessorKey: 'fail_reason',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('Details')}
          className={usageLogsColumnHeaderClassName}
        />
      ),
      cell: function DetailsCell({ row }) {
        const log = row.original
        const failReason = row.getValue('fail_reason') as string
        const status = log.status
        const [dialogOpen, setDialogOpen] = useState(false)

        const isSunoSuccess =
          log.platform === 'suno' && status === TASK_STATUS.SUCCESS
        if (isSunoSuccess) {
          const data = parseTaskData(log.data)
          if (
            data.some(
              (c) =>
                c &&
                typeof c === 'object' &&
                (c as Record<string, unknown>).audio_url
            )
          ) {
            return <AudioPreviewCell log={log} />
          }
        }

        const isVideoTask =
          log.action === TASK_ACTIONS.GENERATE ||
          log.action === TASK_ACTIONS.TEXT_GENERATE ||
          log.action === TASK_ACTIONS.FIRST_TAIL_GENERATE ||
          log.action === TASK_ACTIONS.REFERENCE_GENERATE ||
          log.action === TASK_ACTIONS.REMIX_GENERATE
        const isSuccess = status === TASK_STATUS.SUCCESS
        const isUrl = failReason?.startsWith('http')

        if (isSuccess && isVideoTask && isUrl) {
          const videoUrl = `/v1/videos/${log.task_id}/content`
          return (
            <a
              href={videoUrl}
              target='_blank'
              rel='noopener noreferrer'
              className={usageLogsTableClickableLinkClass}
            >
              {t('Click to preview video')}
            </a>
          )
        }

        if (!failReason) {
          return (
            <span className={usageLogsTableEmptyClass}>
              {t('usageLogs.task.no_details')}
            </span>
          )
        }

        return (
          <>
            <button
              type='button'
              className='group flex max-w-[200px] items-center gap-1 text-left'
              onClick={() => setDialogOpen(true)}
              title={t('Click to view full error message')}
            >
              <span className={usageLogsTableFailReasonClass}>
                {failReason}
              </span>
            </button>
            <FailReasonDialog
              failReason={failReason}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          </>
        )
      },
      meta: { label: t('Details') },
      size: 200,
      maxSize: 220,
    }
  )

  return columns
}
