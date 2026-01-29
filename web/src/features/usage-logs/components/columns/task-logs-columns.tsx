import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { TASK_ACTIONS, TASK_STATUS } from '../../constants'
import {
  taskActionMapper,
  taskStatusMapper,
  taskPlatformMapper,
} from '../../lib/mappers'
import type { TaskLog } from '../../types'
import { FailReasonDialog } from '../dialogs/fail-reason-dialog'
import {
  createTimestampColumn,
  createDurationColumn,
  createChannelColumn,
  createProgressColumn,
} from './column-helpers'

export function useTaskLogsColumns(isAdmin: boolean): ColumnDef<TaskLog>[] {
  const { t } = useTranslation()
  const columns: ColumnDef<TaskLog>[] = [
    createTimestampColumn<TaskLog>({
      accessorKey: 'submit_time',
      title: t('Submit Time'),
      unit: 'seconds',
    }),
    createTimestampColumn<TaskLog>({
      accessorKey: 'finish_time',
      title: t('Finish Time'),
      unit: 'seconds',
    }),
    createDurationColumn<TaskLog>({
      submitTimeKey: 'submit_time',
      finishTimeKey: 'finish_time',
      unit: 'seconds',
      headerLabel: t('Duration'),
    }),
  ]

  // Channel (admin only)
  if (isAdmin) {
    columns.push(createChannelColumn<TaskLog>({ headerLabel: t('Channel') }))
  }

  columns.push(
    // Platform
    {
      accessorKey: 'platform',
      header: t('Platform'),
      cell: ({ row }) => {
        const platform = row.getValue('platform') as string
        return (
          <StatusBadge
            label={t(platform)}
            variant={taskPlatformMapper.getVariant(platform)}
            size='sm'
            copyable={false}
          />
        )
      },
      meta: { label: t('Platform') },
    },

    // Type/Action
    {
      accessorKey: 'action',
      header: t('Type'),
      cell: ({ row }) => {
        const action = row.getValue('action') as string
        return (
          <StatusBadge
            label={t(taskActionMapper.getLabel(action))}
            variant={taskActionMapper.getVariant(action)}
            size='sm'
            copyable={false}
          />
        )
      },
      meta: { label: t('Type') },
    },

    // Task ID
    {
      accessorKey: 'task_id',
      header: t('Task ID'),
      cell: ({ row }) => {
        const taskId = row.getValue('task_id') as string
        return (
          <StatusBadge
            label={taskId}
            autoColor={taskId}
            size='sm'
            className='font-mono'
          />
        )
      },
      meta: { label: t('Task ID') },
    },

    // Status
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
            showDot
          />
        )
      },
      meta: { label: t('Status') },
    },

    createProgressColumn<TaskLog>({ headerLabel: t('Progress') }),

    // Result/Fail Reason - Combined column
    {
      accessorKey: 'fail_reason',
      header: t('Details'),
      cell: ({ row }) => {
        const log = row.original
        const failReason = row.getValue('fail_reason') as string
        const status = log.status
        const [dialogOpen, setDialogOpen] = useState(false)

        // For video generation tasks that succeeded, fail_reason contains the result URL
        const isVideoTask =
          log.action === TASK_ACTIONS.GENERATE ||
          log.action === TASK_ACTIONS.TEXT_GENERATE ||
          log.action === TASK_ACTIONS.FIRST_TAIL_GENERATE ||
          log.action === TASK_ACTIONS.REFERENCE_GENERATE ||
          log.action === TASK_ACTIONS.REMIX_GENERATE
        const isSuccess = status === TASK_STATUS.SUCCESS
        const isUrl = failReason?.startsWith('http')

        // If success and is a URL, show as result link
        if (isSuccess && isVideoTask && isUrl) {
          const videoUrl = `/v1/videos/${log.task_id}/content`
          return (
            <a
              href={videoUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary text-sm hover:underline'
            >
              {t('Click to preview video')}
            </a>
          )
        }

        // Otherwise, show fail reason (if any) using the existing dialog
        if (!failReason) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }

        return (
          <>
            <Button
              variant='ghost'
              className='h-auto max-w-[200px] justify-start overflow-hidden p-0 text-left text-sm font-normal text-red-600 hover:underline'
              onClick={() => setDialogOpen(true)}
              title={t('Click to view full error message')}
            >
              <span className='truncate'>{failReason}</span>
            </Button>
            <FailReasonDialog
              failReason={failReason}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          </>
        )
      },
      meta: { label: t('Details') },
    }
  )

  return columns
}
