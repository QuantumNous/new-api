import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
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

export function useDrawingLogsColumns(
  isAdmin: boolean
): ColumnDef<MidjourneyLog>[] {
  const { t } = useTranslation()
  const columns: ColumnDef<MidjourneyLog>[] = [
    createTimestampColumn<MidjourneyLog>({
      accessorKey: 'submit_time',
      title: t('Submit Time'),
    }),
    createDurationColumn<MidjourneyLog>({
      submitTimeKey: 'submit_time',
      finishTimeKey: 'finish_time',
      headerLabel: t('Duration'),
    }),
  ]

  // Channel (admin only)
  if (isAdmin) {
    columns.push(
      createChannelColumn<MidjourneyLog>({ headerLabel: t('Channel') })
    )
  }

  columns.push(
    // Type (using 'action' field from backend)
    {
      accessorKey: 'action',
      header: t('Type'),
      cell: ({ row }) => {
        const action = row.getValue('action') as string
        return (
          <StatusBadge
            label={t(mjTaskTypeMapper.getLabel(action))}
            variant={mjTaskTypeMapper.getVariant(action)}
            size='sm'
            copyable={false}
          />
        )
      },
      meta: { label: t('Type') },
    },

    // Task ID
    {
      accessorKey: 'mj_id',
      header: t('Task ID'),
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
      meta: { label: t('Task ID'), mobileHidden: true },
    }
  )

  // Submit Result (admin only)
  if (isAdmin) {
    columns.push({
      accessorKey: 'code',
      header: t('Submit Result'),
      cell: ({ row }) => {
        const code = row.getValue('code') as number

        return (
          <StatusBadge
            label={t(mjSubmitResultMapper.getLabel(String(code)))}
            variant={mjSubmitResultMapper.getVariant(String(code))}
            size='sm'
            copyable={false}
            showDot
          />
        )
      },
      meta: { label: t('Submit Result') },
    })
  }

  columns.push(
    // Status
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        return (
          <StatusBadge
            label={t(mjStatusMapper.getLabel(status))}
            variant={mjStatusMapper.getVariant(status)}
            size='sm'
            copyable={false}
            showDot
          />
        )
      },
      meta: { label: t('Status') },
    },

    createProgressColumn<MidjourneyLog>({ headerLabel: t('Progress') }),

    // Image
    {
      accessorKey: 'image_url',
      header: t('Image'),
      cell: function ImageCell({ row }) {
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
              {t('View')}
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
      meta: { label: t('Image'), mobileHidden: true },
    },

    // Prompt (clickable)
    {
      accessorKey: 'prompt',
      header: t('Prompt'),
      cell: function PromptCell({ row }) {
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
              title={t('Click to view full prompt')}
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
      meta: { label: t('Prompt'), mobileHidden: true },
    },

    createFailReasonColumn<MidjourneyLog>({
      headerLabel: t('Fail Reason'),
      cellTitle: t('Click to view full error message'),
    })
  )

  return columns
}
