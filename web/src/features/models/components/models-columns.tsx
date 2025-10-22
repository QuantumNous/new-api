import { type ColumnDef } from '@tanstack/react-table'
import { formatTimestampToDate } from '@/lib/format'
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
import { NAME_RULE_OPTIONS, QUOTA_TYPE_CONFIG } from '../constants'
import { type Model, type Vendor } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

/**
 * Render limited items with "and X more" indicator
 */
function renderLimitedItems(
  items: React.ReactNode[],
  maxDisplay: number = 3
): React.ReactNode {
  if (items.length === 0)
    return <span className='text-muted-foreground'>-</span>

  const displayed = items.slice(0, maxDisplay)
  const remaining = items.length - maxDisplay

  return (
    <div className='flex max-w-full items-center gap-1 overflow-x-auto whitespace-nowrap'>
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
 * Generate models columns configuration
 */
export function getModelsColumns(
  vendorMap: Record<number, Vendor>
): ColumnDef<Model>[] {
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
    },

    // Icon column
    {
      accessorKey: 'icon',
      meta: { label: 'Icon' },
      header: 'Icon',
      cell: ({ row }) => {
        const model = row.original
        const iconKey = model.icon || vendorMap[model.vendor_id ?? 0]?.icon

        if (!iconKey) return <span className='text-muted-foreground'>-</span>

        return (
          <div className='flex items-center justify-center'>
            {getLobeIcon(iconKey, 24)}
          </div>
        )
      },
      enableSorting: false,
      size: 80,
    },

    // Model name column
    {
      accessorKey: 'model_name',
      meta: { label: 'Model Name' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Model Name' />
      ),
      cell: ({ row }) => {
        const name = row.getValue('model_name') as string
        return (
          <StatusBadge
            label={name}
            autoColor={name}
            copyText={name}
            size='sm'
            className='font-mono'
          />
        )
      },
    },

    // Name rule column
    {
      accessorKey: 'name_rule',
      meta: { label: 'Match Type' },
      header: 'Match Type',
      cell: ({ row }) => {
        const rule = row.getValue('name_rule') as number
        const model = row.original
        const config = NAME_RULE_OPTIONS.find((opt) => opt.value === rule)

        if (!config) return <span className='text-muted-foreground'>-</span>

        const hasCount = rule !== 0 && model.matched_count

        return (
          <div className='flex items-center gap-1'>
            <StatusBadge
              label={config.label}
              autoColor={config.label}
              copyText={config.label}
              size='sm'
            />
            {hasCount && (
              <StatusBadge
                label={`${model.matched_count}`}
                variant='neutral'
                size='sm'
                copyable={false}
              />
            )}
          </div>
        )
      },
      enableSorting: false,
      size: 130,
    },

    // Sync official column
    {
      accessorKey: 'sync_official',
      meta: { label: 'Official Sync' },
      header: 'Official Sync',
      cell: ({ row }) => {
        const sync = row.getValue('sync_official') as number
        return (
          <StatusBadge
            variant={sync === 1 ? 'success' : 'warning'}
            showDot
            label={sync === 1 ? 'Yes' : 'No'}
          />
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(String(row.getValue(id)))
      },
      size: 120,
    },

    // Description column
    {
      accessorKey: 'description',
      meta: { label: 'Description' },
      header: 'Description',
      cell: ({ row }) => {
        const desc = row.getValue('description') as string
        if (!desc) return <span className='text-muted-foreground'>-</span>

        const isTruncated = desc.length > 50
        const displayText = truncateText(desc, 50)

        if (!isTruncated) {
          return (
            <span className='block max-w-[300px] truncate text-sm'>{desc}</span>
          )
        }

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className='block max-w-[300px] cursor-help truncate text-sm'>
                  {displayText}
                </span>
              </TooltipTrigger>
              <TooltipContent side='top' className='max-w-md'>
                <p className='text-sm'>{desc}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
      enableSorting: false,
      size: 300,
    },

    // Vendor column
    {
      accessorKey: 'vendor_id',
      meta: { label: 'Vendor' },
      header: 'Vendor',
      cell: ({ row }) => {
        const vendorId = row.getValue('vendor_id') as number
        const vendor = vendorMap[vendorId]

        if (!vendor) return <span className='text-muted-foreground'>-</span>

        const iconElement = getLobeIcon(vendor.icon, 16)

        return (
          <div className='flex items-center gap-2'>
            {iconElement}
            <span className='text-sm'>{vendor.name}</span>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(String(row.getValue(id)))
      },
      enableSorting: false,
      size: 150,
    },

    // Tags column
    {
      accessorKey: 'tags',
      meta: { label: 'Tags' },
      header: 'Tags',
      cell: ({ row }) => {
        const tags = row.getValue('tags') as string
        if (!tags) return <span className='text-muted-foreground'>-</span>

        const tagArray = tags.split(',').filter(Boolean)
        const tagElements = tagArray.map((tag, idx) => (
          <StatusBadge
            key={idx}
            label={tag}
            autoColor={tag}
            copyText={tag}
            size='sm'
          />
        ))

        return renderLimitedItems(tagElements)
      },
      enableSorting: false,
      size: 200,
    },

    // Endpoints column
    {
      accessorKey: 'endpoints',
      meta: { label: 'Endpoints' },
      header: 'Endpoints',
      cell: ({ row }) => {
        const endpoints = row.getValue('endpoints') as string
        if (!endpoints) return <span className='text-muted-foreground'>-</span>

        try {
          const parsed = JSON.parse(endpoints)
          if (typeof parsed !== 'object' || Array.isArray(parsed)) {
            return <span className='text-muted-foreground'>-</span>
          }

          const keys = Object.keys(parsed)
          if (keys.length === 0)
            return <span className='text-muted-foreground'>-</span>

          const keyElements = keys.map((key, idx) => (
            <StatusBadge
              key={idx}
              label={key}
              autoColor={key}
              copyText={key}
              size='sm'
            />
          ))

          return renderLimitedItems(keyElements)
        } catch {
          return <span className='text-muted-foreground'>-</span>
        }
      },
      enableSorting: false,
      size: 180,
    },

    // Bound channels column
    {
      accessorKey: 'bound_channels',
      meta: { label: 'Channels' },
      header: 'Channels',
      cell: ({ row }) => {
        const channels = row.original.bound_channels
        if (!channels || channels.length === 0) {
          return <span className='text-muted-foreground'>-</span>
        }

        const channelElements = channels.map((channel, idx) => (
          <StatusBadge
            key={idx}
            label={channel.name}
            autoColor={channel.name}
            copyText={channel.name}
            size='sm'
          />
        ))

        return renderLimitedItems(channelElements)
      },
      enableSorting: false,
      size: 180,
    },

    // Enable groups column
    {
      accessorKey: 'enable_groups',
      meta: { label: 'Groups' },
      header: 'Groups',
      cell: ({ row }) => {
        const groups = row.original.enable_groups
        if (!groups || groups.length === 0) {
          return <span className='text-muted-foreground'>-</span>
        }

        const groupElements = groups.map((group, idx) => (
          <StatusBadge
            key={idx}
            label={group}
            autoColor={group}
            copyText={group}
            size='sm'
          />
        ))

        return renderLimitedItems(groupElements)
      },
      enableSorting: false,
      size: 180,
    },

    // Quota types column
    {
      accessorKey: 'quota_types',
      meta: { label: 'Billing' },
      header: 'Billing',
      cell: ({ row }) => {
        const quotaTypes = row.original.quota_types
        if (!quotaTypes || quotaTypes.length === 0) {
          return <span className='text-muted-foreground'>-</span>
        }

        const typeElements = quotaTypes
          .map((type, idx) => {
            const config = QUOTA_TYPE_CONFIG[type]
            if (!config) return null

            return (
              <StatusBadge
                key={idx}
                label={config.label}
                autoColor={config.label}
                copyText={config.label}
                size='sm'
              />
            )
          })
          .filter(Boolean)

        return renderLimitedItems(typeElements as React.ReactNode[])
      },
      enableSorting: false,
    },

    // Created time column
    {
      accessorKey: 'created_time',
      meta: { label: 'Created' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Created' />
      ),
      cell: ({ row }) => {
        const time = row.getValue('created_time') as number
        return (
          <div className='min-w-[140px] font-mono text-sm'>
            {formatTimestampToDate(time)}
          </div>
        )
      },
      size: 160,
    },

    // Updated time column
    {
      accessorKey: 'updated_time',
      meta: { label: 'Updated' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Updated' />
      ),
      cell: ({ row }) => {
        const time = row.getValue('updated_time') as number
        return (
          <div className='min-w-[140px] font-mono text-sm'>
            {formatTimestampToDate(time)}
          </div>
        )
      },
      size: 160,
    },

    // Actions column
    {
      id: 'actions',
      cell: ({ row }) => <DataTableRowActions row={row} />,
      size: 60,
    },
  ]
}
