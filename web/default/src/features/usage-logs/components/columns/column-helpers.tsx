/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Zap } from 'lucide-react'
import { formatTimestampToDate, formatTokens } from '@/lib/format'
import { cn } from '@/lib/utils'
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
 * Create a timestamp column - compact mono style matching common logs
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
      if (!timestamp) {
        return <span className='text-muted-foreground/60 text-xs'>-</span>
      }
      return (
        <span className='font-mono text-xs tabular-nums'>
          {formatTimestampToDate(timestamp, unit)}
        </span>
      )
    },
    meta: { label: title },
  }
}

/**
 * Duration pill colors matching common logs timing column
 */
const durationPillBg: Record<string, string> = {
  green:
    'border border-emerald-200/60 bg-emerald-50/70 dark:border-emerald-800/50 dark:bg-emerald-950/25',
  red: 'border border-rose-200/70 bg-rose-50/70 dark:border-rose-800/50 dark:bg-rose-950/25',
  success:
    'border border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-950/20',
  info: 'border border-sky-200/60 bg-sky-50/50 dark:border-sky-800/50 dark:bg-sky-950/20',
  warning:
    'border border-amber-200/60 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20',
}

const durationTextColor: Record<string, string> = {
  green: 'text-emerald-700 dark:text-emerald-400',
  red: 'text-rose-700 dark:text-rose-400',
  success: 'text-emerald-700 dark:text-emerald-400',
  info: 'text-sky-700 dark:text-sky-400',
  warning: 'text-amber-700 dark:text-amber-400',
}

const durationDotColor: Record<string, string> = {
  green: 'bg-emerald-500',
  red: 'bg-rose-500',
  success: 'bg-emerald-500',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
}

/**
 * Create a duration column - pill style matching common logs timing
 */
export function createDurationColumn<T>(config: {
  submitTimeKey: string
  finishTimeKey: string
  unit?: 'seconds' | 'milliseconds'
  headerLabel: string
  warningThresholdSec?: number
}): ColumnDef<T> {
  const {
    submitTimeKey,
    finishTimeKey,
    unit = 'milliseconds',
    headerLabel,
    warningThresholdSec = 60,
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
        return <span className='text-muted-foreground/60 text-xs'>-</span>
      }

      const variant = duration.durationSec > warningThresholdSec ? 'red' : 'green'

      return (
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs font-medium',
            durationPillBg[variant],
            durationTextColor[variant]
          )}
        >
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              durationDotColor[variant]
            )}
            aria-hidden='true'
          />
          {duration.durationSec.toFixed(1)}s
        </span>
      )
    },
    meta: { label: headerLabel },
  }
}

/**
 * Create a channel column (admin only) - #id badge matching common logs
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
      if (!channelId) {
        return <span className='text-muted-foreground/60 text-xs'>-</span>
      }
      return (
        <StatusBadge
          label={`#${channelId}`}
          autoColor={String(channelId)}
          copyText={String(channelId)}
          size='sm'
          className='font-mono'
        />
      )
    },
    meta: { label: headerLabel },
  }
}

/**
 * Create a fail reason column - text-xs truncate, hover underline, dialog
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
        return <span className='text-muted-foreground/60 text-xs'>-</span>
      }

      return (
        <>
          <button
            type='button'
            className='group flex max-w-[200px] items-center gap-1 text-left text-xs'
            onClick={() => setDialogOpen(true)}
            title={cellTitle}
          >
            <span className='truncate leading-snug text-red-600 group-hover:underline dark:text-red-400'>
              {failReason}
            </span>
          </button>
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
 * Create a progress column - compact mono pill
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
        return <span className='text-muted-foreground/60 text-xs'>-</span>
      }
      return (
        <span className='inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-xs'>
          {progress}
        </span>
      )
    },
    meta: { label: headerLabel },
  }
}
