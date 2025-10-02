import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { TASK_ACTIONS, TASK_STATUS, TASK_PLATFORMS } from '../../constants'
import { createStatusMapper } from '../../lib/status'
import type { TaskLog } from '../../types'
import { FailReasonDialog } from '../dialogs/fail-reason-dialog'
import {
  createTimestampColumn,
  createDurationColumn,
  createChannelColumn,
  createProgressColumn,
} from './column-helpers'

// Task action mappings
const actionMapper = createStatusMapper({
  [TASK_ACTIONS.MUSIC]: { label: 'Generate Music', variant: 'neutral' },
  [TASK_ACTIONS.LYRICS]: { label: 'Generate Lyrics', variant: 'pink' },
  [TASK_ACTIONS.GENERATE]: { label: 'Image to Video', variant: 'blue' },
  [TASK_ACTIONS.TEXT_GENERATE]: { label: 'Text to Video', variant: 'blue' },
  [TASK_ACTIONS.FIRST_TAIL_GENERATE]: {
    label: 'First/Last Frame to Video',
    variant: 'blue',
  },
  [TASK_ACTIONS.REFERENCE_GENERATE]: {
    label: 'Reference Video',
    variant: 'blue',
  },
})

// Task status mappings
const statusMapper = createStatusMapper({
  [TASK_STATUS.SUCCESS]: { label: 'Success', variant: 'green' },
  [TASK_STATUS.NOT_START]: { label: 'Not Started', variant: 'neutral' },
  [TASK_STATUS.SUBMITTED]: { label: 'Queued', variant: 'yellow' },
  [TASK_STATUS.IN_PROGRESS]: { label: 'In Progress', variant: 'blue' },
  [TASK_STATUS.FAILURE]: { label: 'Failed', variant: 'red' },
  [TASK_STATUS.QUEUED]: { label: 'Queued', variant: 'orange' },
  [TASK_STATUS.UNKNOWN]: { label: 'Unknown', variant: 'neutral' },
})

// Platform mappings
const platformMapper = createStatusMapper({
  [TASK_PLATFORMS.SUNO]: { label: 'suno', variant: 'green' },
  [TASK_PLATFORMS.KLING]: { label: 'kling', variant: 'blue' },
  [TASK_PLATFORMS.RUNWAY]: { label: 'runway', variant: 'violet' },
  [TASK_PLATFORMS.LUMA]: { label: 'luma', variant: 'orange' },
  [TASK_PLATFORMS.VIGGLE]: { label: 'viggle', variant: 'pink' },
})

export function getTaskLogsColumns(isAdmin: boolean): ColumnDef<TaskLog>[] {
  const columns: ColumnDef<TaskLog>[] = [
    createTimestampColumn<TaskLog>({
      accessorKey: 'submit_time',
      title: 'Submit Time',
      unit: 'seconds',
    }),
    createTimestampColumn<TaskLog>({
      accessorKey: 'finish_time',
      title: 'Finish Time',
      unit: 'seconds',
    }),
    createDurationColumn<TaskLog>({
      submitTimeKey: 'submit_time',
      finishTimeKey: 'finish_time',
      unit: 'seconds',
    }),
  ]

  // Channel (admin only)
  if (isAdmin) {
    columns.push(createChannelColumn<TaskLog>({}))
  }

  columns.push(
    // Platform
    {
      accessorKey: 'platform',
      header: 'Platform',
      cell: ({ row }) => {
        const platform = row.getValue('platform') as string
        return (
          <StatusBadge
            label={platform}
            variant={platformMapper.getVariant(platform)}
            size='sm'
            copyable={false}
          />
        )
      },
    },

    // Type/Action
    {
      accessorKey: 'action',
      header: 'Type',
      cell: ({ row }) => {
        const action = row.getValue('action') as string
        return (
          <StatusBadge
            label={actionMapper.getLabel(action)}
            variant={actionMapper.getVariant(action)}
            size='sm'
            copyable={false}
          />
        )
      },
    },

    // Task ID
    {
      accessorKey: 'task_id',
      header: 'Task ID',
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
    },

    // Status
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        return (
          <StatusBadge
            label={statusMapper.getLabel(status, status || 'Submitting')}
            variant={statusMapper.getVariant(status)}
            size='sm'
            copyable={false}
            showDot
          />
        )
      },
    },

    createProgressColumn<TaskLog>(),

    // Result/Fail Reason - Combined column
    {
      accessorKey: 'fail_reason',
      header: 'Details',
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
          log.action === TASK_ACTIONS.REFERENCE_GENERATE
        const isSuccess = status === TASK_STATUS.SUCCESS
        const isUrl = failReason?.startsWith('http')

        // If success and is a URL, show as result link
        if (isSuccess && isVideoTask && isUrl) {
          return (
            <a
              href={failReason}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary text-sm hover:underline'
            >
              View Result
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
              title='Click to view full error message'
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
    }
  )

  return columns
}
