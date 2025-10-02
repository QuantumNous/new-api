import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Clock, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import {
  formatTimestampToDate,
  formatDuration,
  formatTokens,
} from '../../lib/format'
import { FailReasonDialog } from '../dialogs/fail-reason-dialog'

/**
 * Column helper functions and utilities for usage logs tables
 * This module provides reusable column definitions and rendering utilities
 */

// ============================================================================
// Column Rendering Utilities
// ============================================================================

/**
 * Render a status badge with consistent styling
 */
export function renderBadge(
  value: string,
  options?: { className?: string; mono?: boolean }
) {
  return (
    <StatusBadge
      label={value}
      autoColor={value}
      copyText={value}
      size='sm'
      className={options?.mono ? 'truncate font-mono' : options?.className}
    />
  )
}

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
  }
}

/**
 * Create a duration column
 */
export function createDurationColumn<T extends Record<string, any>>(config: {
  submitTimeKey: string
  finishTimeKey: string
  unit?: 'seconds' | 'milliseconds'
}): ColumnDef<T> {
  const { submitTimeKey, finishTimeKey, unit = 'milliseconds' } = config

  return {
    id: 'duration',
    header: 'Duration',
    cell: ({ row }) => {
      const log = row.original
      const duration = formatDuration(
        log[submitTimeKey],
        log[finishTimeKey],
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
  }
}

/**
 * Create a channel column (admin only)
 */
export function createChannelColumn<T>(config: {
  accessorKey?: string
}): ColumnDef<T> {
  const { accessorKey = 'channel_id' } = config

  return {
    accessorKey,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Channel' />
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
  }
}

/**
 * Create a fail reason column
 */
export function createFailReasonColumn<T>(config?: {
  accessorKey?: string
}): ColumnDef<T> {
  const { accessorKey = 'fail_reason' } = config || {}

  return {
    accessorKey,
    header: 'Fail Reason',
    cell: ({ row }) => {
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
}

/**
 * Create a progress column
 */
export function createProgressColumn<T>(config?: {
  accessorKey?: string
}): ColumnDef<T> {
  const { accessorKey = 'progress' } = config || {}

  return {
    accessorKey,
    header: 'Progress',
    cell: ({ row }) => {
      const progress = row.getValue(accessorKey) as string
      if (!progress) {
        return <span className='text-muted-foreground text-sm'>-</span>
      }
      return <div className='font-mono text-sm'>{progress}</div>
    },
  }
}
