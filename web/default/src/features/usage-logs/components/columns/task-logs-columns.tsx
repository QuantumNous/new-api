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
import type { ColumnDef } from '@tanstack/react-table'
import { Music } from 'lucide-react'
/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatLogQuota, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { TASK_STATUS } from '../../constants'
import { taskActionMapper, taskStatusMapper } from '../../lib/mappers'
import {
  getTaskModelName,
  parseTaskDataArray,
  resolveTaskPlatformLabel,
} from '../../lib/task-log-utils'
import type { TaskLog } from '../../types'
import {
  AudioPreviewDialog,
  type AudioClip,
} from '../dialogs/audio-preview-dialog'
import { FailReasonDialog } from '../dialogs/fail-reason-dialog'
import { TaskDetailsDialog } from '../dialogs/task-details-dialog'
import { useUsageLogsContext } from '../usage-logs-provider'
import {
  createDurationColumn,
  createChannelColumn,
  createProgressColumn,
} from './column-helpers'

function AudioPreviewCell({ log }: { log: TaskLog }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const clips = useMemo(() => {
    const data = parseTaskDataArray(log.data)
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
        className='group flex items-center gap-1 text-left text-xs'
        onClick={() => setOpen(true)}
      >
        <Music className='text-muted-foreground size-3' />
        <span className='text-foreground leading-snug group-hover:underline'>
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

function TaskDetailsCell({ log, isAdmin }: { log: TaskLog; isAdmin: boolean }) {
  const { t } = useTranslation()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [failDialogOpen, setFailDialogOpen] = useState(false)
  const failReason = log.fail_reason || ''
  const status = log.status

  const showFailReason =
    !!failReason &&
    !failReason.startsWith('http') &&
    status === TASK_STATUS.FAILURE

  return (
    <div className='flex min-w-0 flex-col items-start gap-1'>
      {log.platform === 'suno' && status === TASK_STATUS.SUCCESS ? (
        <AudioPreviewCell log={log} />
      ) : null}
      {showFailReason ? (
        <button
          type='button'
          className='group max-w-[200px] text-left text-xs'
          onClick={() => setFailDialogOpen(true)}
          title={t('Click to view full error message')}
        >
          <span className='truncate leading-snug text-red-600 group-hover:underline dark:text-red-400'>
            {failReason}
          </span>
        </button>
      ) : null}
      <button
        type='button'
        className='text-foreground text-xs hover:underline'
        onClick={() => setDetailsOpen(true)}
      >
        {t('View details')}
      </button>
      <TaskDetailsDialog
        log={log}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        isAdmin={isAdmin}
      />
      {showFailReason ? (
        <FailReasonDialog
          failReason={failReason}
          open={failDialogOpen}
          onOpenChange={setFailDialogOpen}
        />
      ) : null}
    </div>
  )
}

export function useTaskLogsColumns(isAdmin: boolean): ColumnDef<TaskLog>[] {
  const { t } = useTranslation()
  const columns: ColumnDef<TaskLog>[] = [
    {
      accessorKey: 'submit_time',
      header: t('Submit Time'),
      cell: ({ row }) => {
        const log = row.original
        const submitTime = row.getValue('submit_time') as number

        return (
          <div className='flex min-w-0 flex-col gap-0.5'>
            <span className='truncate font-mono text-xs tabular-nums'>
              {formatTimestampToDate(submitTime, 'seconds')}
            </span>
            {log.finish_time ? (
              <span className='text-muted-foreground/60 truncate font-mono text-[11px] tabular-nums'>
                {formatTimestampToDate(log.finish_time, 'seconds')}
              </span>
            ) : (
              <span className='text-muted-foreground/50 text-[11px]'>-</span>
            )}
          </div>
        )
      },
      size: 180,
    },
  ]

  if (isAdmin) {
    columns.push(createChannelColumn<TaskLog>({ headerLabel: t('Channel') }), {
      id: 'user',
      header: t('User'),
      accessorFn: (row) => row.username || row.user_id,
      cell: function UserCell({ row }) {
        const { sensitiveVisible, setSelectedUserId, setUserInfoDialogOpen } =
          useUsageLogsContext()
        const log = row.original
        const displayName = log.username || String(log.user_id || '?')

        return (
          <button
            type='button'
            className='flex items-center gap-1.5 text-left'
            onClick={(e) => {
              e.stopPropagation()
              setSelectedUserId(log.user_id)
              setUserInfoDialogOpen(true)
            }}
          >
            <Avatar className='ring-border/60 size-6 ring-1 max-sm:hidden'>
              <AvatarFallback
                className={cn(
                  'text-[11px] font-semibold',
                  !sensitiveVisible && 'bg-muted text-muted-foreground'
                )}
                style={
                  sensitiveVisible ? getUserAvatarStyle(displayName) : undefined
                }
              >
                {sensitiveVisible ? getUserAvatarFallback(displayName) : '•'}
              </AvatarFallback>
            </Avatar>
            <span className='text-muted-foreground truncate text-sm hover:underline max-sm:text-xs'>
              {sensitiveVisible ? displayName : '••••'}
            </span>
          </button>
        )
      },
    })
  }

  columns.push(
    {
      accessorKey: 'task_id',
      header: t('Task ID'),
      cell: ({ row }) => {
        const log = row.original
        const taskId = row.getValue('task_id') as string
        if (!taskId) {
          return <span className='text-muted-foreground/60 text-xs'>-</span>
        }
        const model = getTaskModelName(log)
        const actionLabel = t(taskActionMapper.getLabel(log.action))
        const platformLabel = resolveTaskPlatformLabel(log.platform, t)
        const subtitle = [platformLabel, actionLabel, model]
          .filter(Boolean)
          .join(' · ')

        return (
          <div className='flex min-w-0 flex-col gap-0.5'>
            <StatusBadge
              label={taskId}
              copyText={taskId}
              variant='neutral'
              size='sm'
              className='border-border/60 bg-muted/30 !text-foreground w-full max-w-none shrink-0 items-start rounded-md border px-1.5 py-0.5 font-mono !whitespace-normal max-sm:h-auto max-sm:!text-[11px] max-sm:leading-tight'
            >
              <span className='break-all whitespace-normal'>{taskId}</span>
            </StatusBadge>
            <span className='text-muted-foreground/60 text-[11px] leading-snug break-all max-sm:text-[10px]'>
              {subtitle}
            </span>
          </div>
        )
      },
      size: 360,
      minSize: 280,
      meta: { mobileTitle: true },
    },
    {
      accessorKey: 'quota',
      header: t('Cost'),
      cell: ({ row }) => {
        const quota = row.getValue('quota') as number | undefined
        if (!quota) {
          return <span className='text-muted-foreground/60 text-xs'>-</span>
        }
        return (
          <span className='border-border/80 bg-muted/60 inline-flex h-6 w-fit items-center rounded-md border px-2 [font-family:var(--font-body)] text-sm leading-none font-semibold tabular-nums max-sm:h-5 max-sm:px-1.5 max-sm:text-xs'>
            {formatLogQuota(quota)}
          </span>
        )
      },
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
      header: t('Status'),
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        return (
          <StatusBadge
            label={t(taskStatusMapper.getLabel(status, status || 'Submitting'))}
            variant={taskStatusMapper.getVariant(status)}
            size='sm'
            copyable={false}
            className='-ml-1.5 max-sm:ml-0 max-sm:!text-[11px]'
          />
        )
      },
    },
    createProgressColumn<TaskLog>({ headerLabel: t('Progress') }),
    {
      id: 'details',
      header: t('Details'),
      cell: function DetailsCell({ row }) {
        return <TaskDetailsCell log={row.original} isAdmin={isAdmin} />
      },
      size: 180,
      maxSize: 220,
    }
  )

  return columns
}
