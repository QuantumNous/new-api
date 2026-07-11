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
/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyableStatusBadge, StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getUserAvatarFallback, getUserAvatarProps } from '@/lib/avatar'
import { formatLogQuota, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  getTaskPlatformName,
  taskActionMapper,
  taskStatusMapper,
} from '../../lib/mappers'
import { getTaskModelName } from '../../lib/task-log-utils'
import type { TaskLog } from '../../types'
import { TaskDetailsDialog } from '../dialogs/task-details-dialog'
import { useUsageLogsContext } from '../usage-logs-provider'
import {
  createDurationColumn,
  createChannelColumn,
  createProgressColumn,
} from './column-helpers'

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
            <span className='text-xs tabular-nums'>
              {formatTimestampToDate(submitTime, 'seconds')}
            </span>
            {log.finish_time ? (
              <span className='text-subtle-foreground text-xs tabular-nums'>
                {formatTimestampToDate(log.finish_time, 'seconds')}
              </span>
            ) : (
              <span className='text-subtle-foreground text-xs'>-</span>
            )}
          </div>
        )
      },
      size: 180,
      meta: {
        cardRole: 'primary',
        cardOrder: 10,
        contentMode: 'full',
      },
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
        const avatarProps = sensitiveVisible
          ? getUserAvatarProps(displayName)
          : undefined

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
            <Avatar className='size-6 max-sm:hidden'>
              <AvatarFallback
                className={cn('text-xs font-semibold', avatarProps?.className)}
                style={avatarProps?.style}
              >
                {sensitiveVisible ? getUserAvatarFallback(displayName) : '•'}
              </AvatarFallback>
            </Avatar>
            <span
              className='text-muted-foreground max-w-[100px] truncate text-sm hover:underline'
              title={sensitiveVisible ? displayName : undefined}
            >
              {sensitiveVisible ? displayName : '••••'}
            </span>
          </button>
        )
      },
      meta: {
        cardRole: 'primary',
        cardOrder: 30,
        contentMode: 'wrap',
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
          return <span className='text-subtle-foreground text-xs'>-</span>
        }
        const subtitle = [
          getTaskPlatformName(log.platform),
          t(taskActionMapper.getLabel(log.action)),
          getTaskModelName(log),
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <div className='flex min-w-0 flex-col items-start gap-0.5'>
            <CopyableStatusBadge
              value={taskId}
              variant='neutral'
              size='sm'
              className='max-w-full min-w-0 shrink overflow-hidden font-mono [&>[data-slot=status-badge-label]]:max-w-full [&>[data-slot=status-badge-label]]:min-w-0 [&>[data-slot=status-badge-label]]:shrink [&>[data-slot=status-badge-label]]:overflow-hidden [&>[data-slot=status-badge-label]]:text-ellipsis'
            >
              {taskId}
            </CopyableStatusBadge>
            <span
              className='text-subtle-foreground max-w-full truncate text-xs'
              title={subtitle}
            >
              {subtitle}
            </span>
          </div>
        )
      },
      size: 260,
      meta: {
        cardRole: 'title',
        cardSpan: 2,
        contentMode: 'full',
      },
    },
    {
      accessorKey: 'quota',
      header: t('Cost'),
      cell: ({ row }) => {
        const quota = row.getValue('quota') as number | undefined
        if (!quota) {
          return <span className='text-subtle-foreground text-xs'>-</span>
        }
        return (
          <span className='text-sm font-medium tabular-nums'>
            {formatLogQuota(quota)}
          </span>
        )
      },
      meta: {
        cardRole: 'primary',
        cardOrder: 40,
        contentMode: 'full',
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
          <StatusBadge variant={taskStatusMapper.getVariant(status)} size='sm'>
            {t(taskStatusMapper.getLabel(status, status || 'Submitting'))}
          </StatusBadge>
        )
      },
      meta: {
        cardRole: 'badge',
        contentMode: 'full',
      },
    },
    createProgressColumn<TaskLog>({ headerLabel: t('Progress') }),
    {
      id: 'details',
      header: t('Details'),
      enableSorting: false,
      cell: function DetailsCell({ row }) {
        return <TaskDetailsCell log={row.original} isAdmin={isAdmin} />
      },
      size: 120,
      maxSize: 140,
      meta: {
        cardRole: 'secondary',
        cardOrder: 20,
        cardSpan: 2,
        contentMode: 'summary',
      },
    }
  )

  return columns
}

function TaskDetailsCell({ log, isAdmin }: { log: TaskLog; isAdmin: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const isFailed = !!log.fail_reason && log.fail_reason.trim() !== ''

  return (
    <>
      <button
        type='button'
        className={cn(
          'text-xs leading-snug hover:underline',
          isFailed ? 'text-destructive' : 'text-foreground'
        )}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title={t('View the complete details for this task')}
      >
        {t('View')}
      </button>
      <TaskDetailsDialog
        log={log}
        isAdmin={isAdmin}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
