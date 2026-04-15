/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Clock, Zap } from 'lucide-react'
import { formatTimestampToDate, formatTokens } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { formatDuration } from '../../lib/format'
import { FailReasonDialog } from '../dialogs/fail-reason-dialog'

/**
 * Cache tooltip component for token display
 */
export function CacheTooltip({
  tokens,
  label,
  color,
}: {
  tokens: number
  label: string
  color: string
}) {
  if (tokens <= 0) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Zap className={`size-3 flex-shrink-0 ${color}`} />
        </TooltipTrigger>
        <TooltipContent side='top'>
          <p className='text-xs'>
            {label}: {formatTokens(tokens)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Column Definition Factories
// ============================================================================

/**
 * Create a timestamp column
 */
export function createTimestampColumn<T>(config: {
  accessorKey: string
  title: string
  unit?: 'seconds' | 'milliseconds'
}): ColumnDef<T> {
  const { accessorKey, title, unit = 'milliseconds' } = config

  return {
    accessorKey,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={title} />
    ),
    cell: ({ row }) => {
      const timestamp = row.getValue(accessorKey) as number
      return (
        <div className='min-w-[140px] font-mono text-sm'>
          {formatTimestampToDate(timestamp, unit)}
        </div>
      )
    },
    meta: { label: title },
  }
}

/**
 * Create a duration column
 */
export function createDurationColumn<T>(config: {
  submitTimeKey: string
  finishTimeKey: string
  unit?: 'seconds' | 'milliseconds'
  headerLabel: string
}): ColumnDef<T> {
  const {
    submitTimeKey,
    finishTimeKey,
    unit = 'milliseconds',
    headerLabel,
  } = config

  return {
    id: 'duration',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={headerLabel} />
    ),
    cell: ({ row }) => {
      const log = row.original as Record<string, unknown>
      const duration = formatDuration(
        log[submitTimeKey] as number | undefined,
        log[finishTimeKey] as number | undefined,
        unit
      )

      if (!duration) {
        return <div className='text-muted-foreground text-sm'>-</div>
      }

      return (
        <StatusBadge
          label={`${duration.durationSec.toFixed(1)}s`}
          variant={duration.variant}
          icon={Clock}
          size='sm'
          copyable={false}
        />
      )
    },
    meta: { label: headerLabel },
  }
}

/**
 * Create a channel column (admin only)
 */
export function createChannelColumn<T>(config: {
  accessorKey?: string
  headerLabel: string
}): ColumnDef<T> {
  const { accessorKey = 'channel_id', headerLabel } = config

  return {
    accessorKey,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={headerLabel} />
    ),
    cell: ({ row }) => {
      const channelId = row.getValue(accessorKey) as number
      return (
        <StatusBadge
          label={`${channelId}`}
          autoColor={`channel-${channelId}`}
          size='sm'
        />
      )
    },
    meta: { label: headerLabel },
  }
}

/**
 * Create a fail reason column
 */
export function createFailReasonColumn<T>(config: {
  accessorKey?: string
  headerLabel: string
  cellTitle: string
}): ColumnDef<T> {
  const { accessorKey = 'fail_reason', headerLabel, cellTitle } = config

  return {
    accessorKey,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={headerLabel} />
    ),
    cell: function FailReasonCell({ row }) {
      const failReason = row.getValue(accessorKey) as string
      const [dialogOpen, setDialogOpen] = useState(false)

      if (!failReason) {
        return <span className='text-muted-foreground text-sm'>-</span>
      }

      return (
        <>
          <Button
            variant='ghost'
            className='h-auto max-w-[200px] justify-start overflow-hidden p-0 text-left text-sm font-normal text-red-600 hover:underline'
            onClick={() => setDialogOpen(true)}
            title={cellTitle}
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
    meta: { label: headerLabel },
  }
}

/**
 * Create a progress column
 */
export function createProgressColumn<T>(config: {
  accessorKey?: string
  headerLabel: string
}): ColumnDef<T> {
  const { accessorKey = 'progress', headerLabel } = config

  return {
    accessorKey,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={headerLabel} />
    ),
    cell: ({ row }) => {
      const progress = row.getValue(accessorKey) as string
      if (!progress) {
        return <span className='text-muted-foreground text-sm'>-</span>
      }
      return <div className='font-mono text-sm'>{progress}</div>
    },
    meta: { label: headerLabel },
  }
}
