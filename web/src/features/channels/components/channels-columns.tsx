import { type ColumnDef } from '@tanstack/react-table'
import { getLobeIcon } from '@/lib/lobe-icon'
import { truncateText } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/data-table/column-header'
import { StatusBadge } from '@/components/status-badge'
import { CHANNEL_STATUS_CONFIG } from '../constants'
import {
  formatBalance,
  formatRelativeTime,
  formatResponseTime,
  getBalanceVariant,
  getChannelTypeIcon,
  getChannelTypeLabel,
  getResponseTimeConfig,
  isMultiKeyChannel,
  parseModelsList,
  parseGroupsList,
} from '../lib'
import type { Channel } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

/**
 * Render limited items with "and X more" indicator
 */
function renderLimitedItems(
  items: React.ReactNode[],
  maxDisplay: number = 2
): React.ReactNode {
  if (items.length === 0)
    return <span className='text-muted-foreground text-xs'>-</span>

  const displayed = items.slice(0, maxDisplay)
  const remaining = items.length - maxDisplay

  return (
    <div className='flex max-w-full items-center gap-1 overflow-x-auto'>
      {displayed}
      {remaining > 0 && (
        <StatusBadge
          label={`+${remaining}`}
          variant='neutral'
          size='sm'
          copyable={false}
          className='flex-shrink-0'
        />
      )}
    </div>
  )
}

/**
 * Generate channels columns configuration
 */
export function getChannelsColumns(): ColumnDef<Channel>[] {
  return [
    // Checkbox column
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },

    // ID column
    {
      accessorKey: 'id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='ID' />
      ),
      cell: ({ row }) => {
        const id = row.getValue('id') as number
        return (
          <StatusBadge
            label={String(id)}
            variant='neutral'
            copyText={String(id)}
            size='sm'
            className='font-mono'
          />
        )
      },
      size: 80,
    },

    // Name column
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Name' />
      ),
      cell: ({ row }) => {
        const name = row.getValue('name') as string
        const channel = row.original
        const isMultiKey = isMultiKeyChannel(channel)

        return (
          <div className='flex items-center gap-2'>
            <div className='flex flex-col gap-1'>
              <div className='flex items-center gap-1.5'>
                <span className='font-medium'>{truncateText(name, 30)}</span>
                {isMultiKey && (
                  <StatusBadge
                    label={`${channel.channel_info.multi_key_size} keys`}
                    variant='purple'
                    size='sm'
                    copyable={false}
                  />
                )}
              </div>
              {channel.remark && (
                <span className='text-muted-foreground text-xs'>
                  {truncateText(channel.remark, 40)}
                </span>
              )}
            </div>
          </div>
        )
      },
      minSize: 200,
    },

    // Type column
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.getValue('type') as number
        const typeName = getChannelTypeLabel(type)
        const iconName = getChannelTypeIcon(type)
        const icon = getLobeIcon(iconName, 20)

        return (
          <div className='flex items-center gap-2'>
            <div className='bg-background flex h-8 w-8 items-center justify-center rounded-md border'>
              {icon}
            </div>
            <StatusBadge
              label={typeName}
              autoColor={typeName}
              size='sm'
              copyable={false}
            />
          </div>
        )
      },
      size: 140,
      enableSorting: false,
    },

    // Status column
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as number
        const config =
          CHANNEL_STATUS_CONFIG[status as keyof typeof CHANNEL_STATUS_CONFIG] ||
          CHANNEL_STATUS_CONFIG[0]

        return (
          <StatusBadge
            label={config.label}
            variant={config.variant}
            showDot={config.showDot}
            size='sm'
            copyable={false}
          />
        )
      },
      size: 120,
      enableSorting: false,
    },

    // Models column
    {
      accessorKey: 'models',
      header: 'Models',
      cell: ({ row }) => {
        const models = row.getValue('models') as string
        const modelArray = parseModelsList(models)

        if (modelArray.length === 0) {
          return <span className='text-muted-foreground text-xs'>-</span>
        }

        const modelBadges = modelArray.map((model, idx) => (
          <StatusBadge
            key={idx}
            label={model}
            autoColor={model}
            size='sm'
            className='font-mono'
          />
        ))

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>{renderLimitedItems(modelBadges, 2)}</div>
              </TooltipTrigger>
              {modelArray.length > 2 && (
                <TooltipContent
                  side='top'
                  className='border-border bg-popover max-w-md'
                >
                  <div className='flex flex-wrap gap-1'>{modelBadges}</div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      },
      size: 200,
      enableSorting: false,
    },

    // Group column
    {
      accessorKey: 'group',
      header: 'Groups',
      cell: ({ row }) => {
        const group = row.getValue('group') as string
        const groupArray = parseGroupsList(group)

        const groupBadges = groupArray.map((g, idx) => (
          <StatusBadge key={idx} label={g} autoColor={g} size='sm' />
        ))

        return renderLimitedItems(groupBadges, 2)
      },
      size: 150,
      enableSorting: false,
    },

    // Tag column
    {
      accessorKey: 'tag',
      header: 'Tag',
      cell: ({ row }) => {
        const tag = row.getValue('tag') as string | null
        if (!tag)
          return <span className='text-muted-foreground text-xs'>-</span>

        return <StatusBadge label={tag} autoColor={tag} size='sm' />
      },
      size: 120,
      enableSorting: false,
    },

    // Priority column
    {
      accessorKey: 'priority',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Priority' />
      ),
      cell: ({ row }) => {
        const priority = row.getValue('priority') as number | null
        return (
          <StatusBadge
            label={String(priority || 0)}
            variant='neutral'
            size='sm'
            copyable={false}
          />
        )
      },
      size: 100,
    },

    // Weight column
    {
      accessorKey: 'weight',
      header: 'Weight',
      cell: ({ row }) => {
        const weight = row.getValue('weight') as number | null
        return (
          <StatusBadge
            label={String(weight || 0)}
            variant='neutral'
            size='sm'
            copyable={false}
          />
        )
      },
      size: 90,
      enableSorting: false,
    },

    // Balance column
    {
      accessorKey: 'balance',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Balance' />
      ),
      cell: ({ row }) => {
        const balance = row.getValue('balance') as number
        const variant = getBalanceVariant(balance)

        return (
          <StatusBadge
            label={formatBalance(balance)}
            variant={variant}
            size='sm'
            copyable={false}
          />
        )
      },
      size: 120,
    },

    // Response Time column
    {
      accessorKey: 'response_time',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Response' />
      ),
      cell: ({ row }) => {
        const responseTime = row.getValue('response_time') as number
        const config = getResponseTimeConfig(responseTime)

        return (
          <StatusBadge
            label={formatResponseTime(responseTime)}
            variant={config.variant}
            size='sm'
            copyable={false}
          />
        )
      },
      size: 110,
    },

    // Test Time column
    {
      accessorKey: 'test_time',
      header: 'Last Tested',
      cell: ({ row }) => {
        const testTime = row.getValue('test_time') as number
        const timeText = formatRelativeTime(testTime)

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className='text-muted-foreground cursor-default text-xs'>
                  {timeText}
                </span>
              </TooltipTrigger>
              <TooltipContent side='top' className='border-border bg-popover'>
                {new Date(testTime * 1000).toLocaleString()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
      size: 120,
      enableSorting: false,
    },

    // Actions column
    {
      id: 'actions',
      cell: ({ row }) => <DataTableRowActions row={row} />,
      size: 60,
      enableSorting: false,
      enableHiding: false,
    },
  ]
}
