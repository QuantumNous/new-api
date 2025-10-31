import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import {
  mjTaskTypeMapper,
  mjStatusMapper,
  mjSubmitResultMapper,
} from '../../lib/mappers'
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
      meta: { label: 'Type' },
    },

    // Task ID
    {
      accessorKey: 'mj_id',
      header: 'Task ID',
      cell: ({ row }) => {
        const mjId = row.getValue('mj_id') as string

        if (!mjId) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }

        return (
          <StatusBadge
            label={mjId}
            autoColor={mjId}
            size='sm'
            className='font-mono'
          />
        )
      },
      meta: { label: 'Task ID' },
    }
  )

  // Submit Result (admin only)
  if (isAdmin) {
    columns.push({
      accessorKey: 'code',
      header: 'Submit Result',
      cell: ({ row }) => {
        const code = row.getValue('code') as number

        return (
          <StatusBadge
            label={mjSubmitResultMapper.getLabel(String(code))}
            variant={mjSubmitResultMapper.getVariant(String(code))}
            size='sm'
            copyable={false}
            showDot
          />
        )
      },
      meta: { label: 'Submit Result' },
    })
  }

  columns.push(
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
      meta: { label: 'Status' },
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
      meta: { label: 'Image' },
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
      meta: { label: 'Prompt' },
    },

    createFailReasonColumn<MidjourneyLog>()
  )

  return columns
}
