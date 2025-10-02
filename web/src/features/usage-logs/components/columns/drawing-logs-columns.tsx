import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { MJ_TASK_TYPES, MJ_TASK_STATUS } from '../../constants'
import { createStatusMapper } from '../../lib/status'
import type { MidjourneyLog } from '../../types'
import { ImageDialog } from '../dialogs/image-dialog'
import { PromptDialog } from '../dialogs/prompt-dialog'
import {
  createTimestampColumn,
  createDurationColumn,
  createChannelColumn,
  createProgressColumn,
  createFailReasonColumn,
} from './column-helpers'

// Task type mappings
const taskTypeMapper = createStatusMapper({
  [MJ_TASK_TYPES.IMAGINE]: { label: 'Draw', variant: 'blue' },
  [MJ_TASK_TYPES.UPSCALE]: { label: 'Upscale', variant: 'orange' },
  [MJ_TASK_TYPES.VIDEO]: { label: 'Video', variant: 'orange' },
  [MJ_TASK_TYPES.EDITS]: { label: 'Edit', variant: 'orange' },
  [MJ_TASK_TYPES.VARIATION]: { label: 'Vary', variant: 'violet' },
  [MJ_TASK_TYPES.HIGH_VARIATION]: { label: 'Vary (Strong)', variant: 'violet' },
  [MJ_TASK_TYPES.LOW_VARIATION]: { label: 'Vary (Subtle)', variant: 'violet' },
  [MJ_TASK_TYPES.PAN]: { label: 'Pan', variant: 'cyan' },
  [MJ_TASK_TYPES.DESCRIBE]: { label: 'Describe', variant: 'yellow' },
  [MJ_TASK_TYPES.BLEND]: { label: 'Blend', variant: 'lime' },
  [MJ_TASK_TYPES.UPLOAD]: { label: 'Upload', variant: 'blue' },
  [MJ_TASK_TYPES.SHORTEN]: { label: 'Shorten', variant: 'pink' },
  [MJ_TASK_TYPES.REROLL]: { label: 'Reroll', variant: 'indigo' },
  [MJ_TASK_TYPES.INPAINT]: { label: 'Inpaint', variant: 'teal' },
  [MJ_TASK_TYPES.SWAP_FACE]: { label: 'Swap Face', variant: 'purple' },
  [MJ_TASK_TYPES.ZOOM]: { label: 'Zoom', variant: 'green' },
  [MJ_TASK_TYPES.CUSTOM_ZOOM]: { label: 'Custom Zoom', variant: 'green' },
})

// Task status mappings
const statusMapper = createStatusMapper({
  [MJ_TASK_STATUS.SUCCESS]: { label: 'Success', variant: 'green' },
  [MJ_TASK_STATUS.NOT_START]: { label: 'Not Started', variant: 'neutral' },
  [MJ_TASK_STATUS.SUBMITTED]: { label: 'Queued', variant: 'yellow' },
  [MJ_TASK_STATUS.IN_PROGRESS]: { label: 'In Progress', variant: 'blue' },
  [MJ_TASK_STATUS.FAILURE]: { label: 'Failed', variant: 'red' },
  [MJ_TASK_STATUS.MODAL]: { label: 'Waiting', variant: 'amber' },
})

export function getDrawingLogsColumns(
  isAdmin: boolean
): ColumnDef<MidjourneyLog>[] {
  const columns: ColumnDef<MidjourneyLog>[] = [
    createTimestampColumn<MidjourneyLog>({
      accessorKey: 'submit_time',
      title: 'Submit Time',
    }),
    createDurationColumn<MidjourneyLog>({
      submitTimeKey: 'submit_time',
      finishTimeKey: 'finish_time',
    }),
  ]

  // Channel (admin only)
  if (isAdmin) {
    columns.push(createChannelColumn<MidjourneyLog>({}))
  }

  columns.push(
    // Type (using 'action' field from backend)
    {
      accessorKey: 'action',
      header: 'Type',
      cell: ({ row }) => {
        const action = row.getValue('action') as string
        return (
          <StatusBadge
            label={taskTypeMapper.getLabel(action)}
            variant={taskTypeMapper.getVariant(action)}
            size='sm'
            copyable={false}
          />
        )
      },
    },

    // Task ID
    {
      accessorKey: 'mj_id',
      header: 'Task ID',
      cell: ({ row }) => {
        const mjId = row.getValue('mj_id') as string
        return (
          <StatusBadge
            label={mjId}
            autoColor={mjId}
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
            label={statusMapper.getLabel(status)}
            variant={statusMapper.getVariant(status)}
            size='sm'
            copyable={false}
            showDot
          />
        )
      },
    },

    createProgressColumn<MidjourneyLog>(),

    // Image
    {
      accessorKey: 'image_url',
      header: 'Image',
      cell: ({ row }) => {
        const log = row.original
        const imageUrl = row.getValue('image_url') as string
        const [dialogOpen, setDialogOpen] = useState(false)

        if (!imageUrl) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }

        return (
          <>
            <Button
              variant='ghost'
              className='text-primary h-auto p-0 text-sm font-normal hover:underline'
              onClick={() => setDialogOpen(true)}
            >
              View
            </Button>
            <ImageDialog
              imageUrl={imageUrl}
              taskId={log.mj_id}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          </>
        )
      },
    },

    // Prompt (clickable)
    {
      accessorKey: 'prompt',
      header: 'Prompt',
      cell: ({ row }) => {
        const log = row.original
        const prompt = row.getValue('prompt') as string
        const [dialogOpen, setDialogOpen] = useState(false)

        if (!prompt) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }

        return (
          <>
            <Button
              variant='ghost'
              className='h-auto max-w-[300px] justify-start overflow-hidden p-0 text-left text-sm font-normal hover:underline'
              onClick={() => setDialogOpen(true)}
              title='Click to view full prompt'
            >
              <span className='truncate'>{prompt}</span>
            </Button>
            <PromptDialog
              prompt={prompt}
              promptEn={log.prompt_en}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          </>
        )
      },
    },

    createFailReasonColumn<MidjourneyLog>()
  )

  return columns
}
