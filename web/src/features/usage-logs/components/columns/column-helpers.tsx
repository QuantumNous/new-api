import type { ColumnDef } from '@tanstack/react-table'
import { Clock } from 'lucide-react'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { formatTimestampToDate, formatDuration } from '../../lib/format'

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
      if (!failReason) {
        return <span className='text-muted-foreground text-sm'>-</span>
      }
      return (
        <div
          className='max-w-[200px] truncate text-sm text-red-600'
          title={failReason}
        >
          {failReason}
        </div>
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
