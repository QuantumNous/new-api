import { type ColumnDef } from '@tanstack/react-table'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CopyButton } from '@/components/copy-button'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { REDEMPTION_STATUSES } from '../constants'
import { isRedemptionExpired } from '../lib'
import { type Redemption } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export const redemptionsColumns: ColumnDef<Redemption>[] = [
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
        className='translate-y-[2px]'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-[2px]'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='ID' />
    ),
    cell: ({ row }) => {
      return <div className='w-[60px]'>{row.getValue('id')}</div>
    },
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => {
      return (
        <div className='max-w-[150px] truncate font-medium'>
          {row.getValue('name')}
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const redemption = row.original
      const statusValue = row.getValue('status') as number

      // Check if expired
      if (isRedemptionExpired(redemption.expired_time, statusValue)) {
        return (
          <StatusBadge
            label='Expired'
            variant='warning'
            showDot={true}
            copyable={false}
          />
        )
      }

      const statusConfig = REDEMPTION_STATUSES[statusValue]

      if (!statusConfig) {
        return null
      }

      return (
        <StatusBadge
          label={statusConfig.label}
          variant={statusConfig.variant}
          showDot={statusConfig.showDot}
          copyable={false}
        />
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(String(row.getValue(id)))
    },
  },
  {
    id: 'code',
    accessorKey: 'key',
    header: 'Code',
    cell: function CodeCell({ row }) {
      const redemption = row.original
      const key = redemption.key
      const maskedKey = `${key.slice(0, 8)}${'*'.repeat(16)}${key.slice(-8)}`

      return (
        <div className='flex items-center'>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='ghost' size='sm' className='h-7 font-mono'>
                {maskedKey}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto'>
              <div className='space-y-2'>
                <p className='text-muted-foreground text-xs'>Full Code:</p>
                <Input value={key} readOnly className='h-8 font-mono' />
              </div>
            </PopoverContent>
          </Popover>
          <CopyButton
            value={key}
            className='size-7'
            iconClassName='size-3.5'
            tooltip='Copy code'
            aria-label='Copy redemption code'
          />
        </div>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'quota',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Quota' />
    ),
    cell: ({ row }) => {
      const quota = row.getValue('quota') as number
      return <Badge variant='secondary'>{formatQuota(quota)}</Badge>
    },
  },
  {
    accessorKey: 'created_time',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Created' />
    ),
    cell: ({ row }) => {
      return (
        <div className='min-w-[140px] font-mono text-sm'>
          {formatTimestampToDate(row.getValue('created_time'))}
        </div>
      )
    },
  },
  {
    accessorKey: 'expired_time',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Expires' />
    ),
    cell: ({ row }) => {
      const expiredTime = row.getValue('expired_time') as number
      if (expiredTime === 0) {
        return <Badge variant='outline'>Never</Badge>
      }
      const isExpired = expiredTime * 1000 < Date.now()
      return (
        <div
          className={`min-w-[140px] font-mono text-sm ${isExpired ? 'text-destructive' : ''}`}
        >
          {formatTimestampToDate(expiredTime)}
        </div>
      )
    },
  },
  {
    accessorKey: 'used_user_id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Redeemed By' />
    ),
    cell: ({ row }) => {
      const userId = row.getValue('used_user_id') as number
      const redemption = row.original

      if (userId === 0) {
        return <span className='text-muted-foreground text-sm'>-</span>
      }

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant='outline' className='cursor-help'>
              User {userId}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className='space-y-1 text-xs'>
              <div>User ID: {userId}</div>
              {redemption.redeemed_time > 0 && (
                <div>
                  Redeemed: {formatTimestampToDate(redemption.redeemed_time)}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
