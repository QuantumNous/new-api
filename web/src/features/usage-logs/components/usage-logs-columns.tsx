import { type ColumnDef } from '@tanstack/react-table'
import { Route, Info, Zap } from 'lucide-react'
import { formatTimestamp } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { logTypes } from '../data/data'
import type { UsageLog } from '../data/schema'
import {
  formatTokens,
  formatUseTime,
  getTimeColor,
  formatModelName,
  parseLogOther,
  formatLogQuota,
} from '../lib/format'
import { isDisplayableLogType, isTimingLogType } from '../lib/utils'
import { useUsageLogsContext } from './usage-logs-provider'

/**
 * Get log type configuration by type number
 */
const getLogTypeConfig = (type: number) => {
  return logTypes.find((t) => t.value === type) || logTypes[0]
}

/**
 * Cache tooltip component for token display
 */
const CacheTooltip = ({
  tokens,
  label,
  color,
}: {
  tokens: number
  label: string
  color: string
}) =>
  tokens > 0 ? (
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
  ) : null

/**
 * Render a simple status badge cell with auto-color and copy
 */
const renderBadgeCell = (
  value: string | null,
  config?: {
    className?: string
    maxWidth?: string
  }
) => {
  if (!value) return null

  return (
    <StatusBadge
      label={value}
      autoColor={value}
      copyText={value}
      size='sm'
      className={config?.className}
    />
  )
}

export function getUsageLogsColumns(isAdmin: boolean): ColumnDef<UsageLog>[] {
  const columns: ColumnDef<UsageLog>[] = [
    // Time column
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Time' />
      ),
      cell: ({ row }) => {
        const timestamp = row.getValue('created_at') as number
        return (
          <div className='text-muted-foreground min-w-[140px] text-sm'>
            {formatTimestamp(timestamp)}
          </div>
        )
      },
      enableHiding: false,
    },

    // Type column
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Type' />
      ),
      cell: ({ row }) => {
        const type = row.getValue('type') as number
        const config = getLogTypeConfig(type)

        return (
          <StatusBadge
            label={config.label}
            variant='neutral'
            size='sm'
            copyable={false}
          />
        )
      },
      filterFn: (row, id, value) => {
        if (!value || value.length === 0) return true
        return value.includes(String(row.getValue(id)))
      },
    },
  ]

  // Admin-only columns
  if (isAdmin) {
    columns.push(
      // Channel column
      {
        accessorKey: 'channel',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Channel' />
        ),
        cell: ({ row }) => {
          const log = row.original

          if (!isDisplayableLogType(log.type)) {
            return null
          }

          const other = parseLogOther(log.other)
          const isMultiKey = other?.admin_info?.is_multi_key
          const multiKeyIndex = other?.admin_info?.multi_key_index

          return (
            <div className='flex items-center gap-1'>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <StatusBadge
                        label={String(log.channel)}
                        autoColor={log.channel_name || String(log.channel)}
                        copyText={String(log.channel)}
                        size='sm'
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{log.channel_name || 'Unknown Channel'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {isMultiKey && (
                <StatusBadge
                  label={String(multiKeyIndex ?? '?')}
                  variant='neutral'
                  size='sm'
                  copyable={false}
                  className='size-6 justify-center p-0'
                />
              )}
            </div>
          )
        },
      },

      // Username column
      {
        accessorKey: 'username',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='User' />
        ),
        cell: function UsernameCell({ row }) {
          const { setSelectedUserId, setUserInfoDialogOpen } =
            useUsageLogsContext()
          const log = row.original
          const username = row.getValue('username') as string
          if (!username) return null

          return (
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedUserId(log.user_id)
                  setUserInfoDialogOpen(true)
                }}
                className='bg-primary/10 hover:bg-primary/20 flex size-6 cursor-pointer items-center justify-center rounded-full text-xs font-medium transition-colors'
              >
                {username.charAt(0).toUpperCase()}
              </button>
              <span className='max-w-[100px] truncate'>{username}</span>
            </div>
          )
        },
      }
    )
  }

  // Common columns (continued)
  columns.push(
    // Token column
    {
      accessorKey: 'token_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Token' />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const tokenName = row.getValue('token_name') as string
        return renderBadgeCell(tokenName, {
          className: 'max-w-[120px] truncate',
        })
      },
    },

    // Group column
    {
      accessorKey: 'group',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Group' />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) return null

        const group = row.getValue('group') as string
        return renderBadgeCell(group)
      },
    },

    // Model column
    {
      accessorKey: 'model_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Model' />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) {
          return null
        }

        const modelInfo = formatModelName(log)

        if (!modelInfo.isMapped) {
          return (
            <StatusBadge
              label={modelInfo.name}
              autoColor={modelInfo.name}
              copyText={modelInfo.name}
              size='sm'
              className='max-w-[150px] truncate font-mono'
            />
          )
        }

        // Model is mapped - show popover
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                className='h-auto p-0 hover:bg-transparent'
              >
                <div className='flex items-center gap-1'>
                  <StatusBadge
                    label={modelInfo.name}
                    autoColor={modelInfo.name}
                    copyText={modelInfo.name}
                    size='sm'
                    className='max-w-[150px] truncate font-mono'
                  />
                  <Route className='text-muted-foreground size-3' />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-80'>
              <div className='space-y-2'>
                <div className='flex items-start justify-between gap-4'>
                  <span className='text-sm font-medium'>Request Model:</span>
                  <StatusBadge
                    label={modelInfo.name}
                    autoColor={modelInfo.name}
                    copyText={modelInfo.name}
                    size='sm'
                    className='font-mono'
                  />
                </div>
                <div className='flex items-start justify-between gap-4'>
                  <span className='text-sm font-medium'>Actual Model:</span>
                  <StatusBadge
                    label={modelInfo.actualModel || ''}
                    autoColor={modelInfo.actualModel}
                    copyText={modelInfo.actualModel}
                    size='sm'
                    className='font-mono'
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )
      },
    },

    // Use time column
    {
      accessorKey: 'use_time',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Time / FRT' />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isTimingLogType(log.type)) {
          return null
        }

        const useTime = row.getValue('use_time') as number
        const other = parseLogOther(log.other)
        const frt = other?.frt

        return (
          <div className='flex items-center gap-1'>
            <StatusBadge
              label={formatUseTime(useTime)}
              variant={getTimeColor(useTime)}
              size='sm'
              copyable={false}
            />
            {log.is_stream && frt && (
              <StatusBadge
                label={formatUseTime(frt / 1000)}
                variant={getTimeColor(frt / 1000)}
                size='sm'
                copyable={false}
              />
            )}
            <StatusBadge
              label={log.is_stream ? 'Stream' : 'Non-stream'}
              variant={log.is_stream ? 'info' : 'neutral'}
              size='sm'
              copyable={false}
            />
          </div>
        )
      },
    },

    // Tokens column
    {
      id: 'tokens',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Tokens' />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) {
          return null
        }

        const promptTokens = log.prompt_tokens || 0
        const completionTokens = log.completion_tokens || 0
        const other = parseLogOther(log.other)
        const cacheReadTokens = other?.cache_tokens || 0
        const cacheWriteTokens = other?.cache_creation_tokens || 0

        const totalTokens =
          promptTokens + completionTokens + cacheReadTokens + cacheWriteTokens

        if (totalTokens === 0) {
          return <span className='text-muted-foreground'>-</span>
        }

        const hasDetailedBreakdown = promptTokens > 0 && completionTokens > 0

        // If no detailed breakdown, just show total
        if (!hasDetailedBreakdown) {
          return (
            <div className='font-mono text-sm font-medium'>
              {formatTokens(totalTokens)}
            </div>
          )
        }

        // Horizontal layout with unified badge
        return (
          <div className='bg-muted/50 divide-border inline-flex items-center divide-x overflow-hidden rounded-md text-sm'>
            {promptTokens > 0 && (
              <div className='flex items-center gap-1.5 px-3 py-1'>
                <span className='text-muted-foreground text-xs'>In:</span>
                <span className='font-mono font-medium'>
                  {formatTokens(promptTokens)}
                </span>
                <CacheTooltip
                  tokens={cacheReadTokens}
                  label='Cache Read'
                  color='fill-amber-500 text-amber-500'
                />
              </div>
            )}
            {completionTokens > 0 && (
              <div className='flex items-center gap-1.5 px-3 py-1'>
                <span className='text-muted-foreground text-xs'>Out:</span>
                <span className='font-mono font-medium'>
                  {formatTokens(completionTokens)}
                </span>
                <CacheTooltip
                  tokens={cacheWriteTokens}
                  label='Cache Write'
                  color='fill-blue-500 text-blue-500'
                />
              </div>
            )}
          </div>
        )
      },
    },

    // Cost column
    {
      accessorKey: 'quota',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Cost' />
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isDisplayableLogType(log.type)) {
          return null
        }

        const quota = row.getValue('quota') as number
        return (
          <span className='font-mono text-sm font-medium'>
            {formatLogQuota(quota)}
          </span>
        )
      },
    },

    // IP column
    {
      accessorKey: 'ip',
      header: ({ column }) => (
        <div className='flex items-center gap-1'>
          <DataTableColumnHeader column={column} title='IP' />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className='text-muted-foreground size-3' />
              </TooltipTrigger>
              <TooltipContent>
                <span className='max-w-xs'>
                  IP is only recorded when user enables IP logging in settings
                </span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
      cell: ({ row }) => {
        const log = row.original
        if (!isTimingLogType(log.type)) return null

        const ip = row.getValue('ip') as string
        return renderBadgeCell(ip, { className: 'font-mono' })
      },
    },

    // Details column
    {
      accessorKey: 'content',
      header: 'Details',
      cell: ({ row }) => {
        const log = row.original
        const content = row.getValue('content') as string

        if (log.type !== 2) {
          return <div className='max-w-[200px] truncate text-sm'>{content}</div>
        }

        // For consume logs, show pricing info (only group ratio)
        const other = parseLogOther(log.other)
        if (!other || !other.group_ratio || other.group_ratio === 1) {
          return <div className='max-w-[200px] truncate text-sm'>{content}</div>
        }

        return (
          <div className='max-w-[200px] text-sm'>
            <span className='text-muted-foreground'>Group: </span>
            <span className='font-mono'>{other.group_ratio}x</span>
          </div>
        )
      },
    }
  )

  // Admin-only retry column
  if (isAdmin) {
    columns.push({
      accessorKey: 'retry',
      header: 'Retry',
      cell: ({ row }) => {
        const log = row.original
        if (!isTimingLogType(log.type)) {
          return null
        }

        const other = parseLogOther(log.other)
        const useChannel = other?.admin_info?.use_channel

        if (!useChannel || useChannel.length === 0) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }

        return (
          <div className='text-sm'>
            <span className='text-muted-foreground'>Ch: </span>
            <span className='font-mono'>{useChannel.join(' → ')}</span>
          </div>
        )
      },
    })
  }

  return columns
}
