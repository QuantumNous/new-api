import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { mjTaskTypeMapper, mjStatusMapper } from '../../lib/mappers'
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
            label={mjTaskTypeMapper.getLabel(action)}
            variant={mjTaskTypeMapper.getVariant(action)}
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
            label={mjStatusMapper.getLabel(status)}
            variant={mjStatusMapper.getVariant(status)}
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
