import type { ColumnDef } from '@tanstack/react-table'
import { StatusBadge } from '@/components/status-badge'
import { TASK_ACTIONS, TASK_STATUS, TASK_PLATFORMS } from '../../constants'
import { createStatusMapper } from '../../lib/status'
import type { TaskLog } from '../../types'
import {
  createTimestampColumn,
  createDurationColumn,
  createChannelColumn,
  createProgressColumn,
  createFailReasonColumn,
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
          />
        )
      },
    },

    createProgressColumn<TaskLog>(),
    createFailReasonColumn<TaskLog>(),

    // Result URL
    {
      id: 'result_url',
      header: 'Result',
      cell: ({ row }) => {
        const log = row.original
        // Parse data field to get result URL
        let resultUrl = ''
        try {
          const data = log.data ? JSON.parse(log.data) : null
          resultUrl = data?.video_url || data?.audio_url || data?.url || ''
        } catch {
          // Ignore parse error
        }

        if (!resultUrl) return <span className='text-muted-foreground'>-</span>

        return (
          <a
            href={resultUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary text-sm hover:underline'
          >
            View
          </a>
        )
      },
    }
  )

  return columns
}
