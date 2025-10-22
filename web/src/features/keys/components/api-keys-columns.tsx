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
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CopyButton } from '@/components/copy-button'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { API_KEY_STATUSES } from '../constants'
import { type ApiKey } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export const apiKeysColumns: ColumnDef<ApiKey>[] = [
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
    meta: { label: 'Select' },
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => {
      return (
        <div className='max-w-[200px] truncate font-medium'>
          {row.getValue('name')}
        </div>
      )
    },
    meta: { label: 'Name' },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const statusValue = row.getValue('status') as number
      const statusConfig = API_KEY_STATUSES[statusValue]

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
    meta: { label: 'Status' },
  },
  {
    id: 'key',
    accessorKey: 'key',
    header: 'API Key',
    cell: function KeyCell({ row }) {
      const apiKey = row.original
      const fullKey = `sk-${apiKey.key}`
      const maskedKey = `sk-${apiKey.key.slice(0, 4)}${'*'.repeat(16)}${apiKey.key.slice(-4)}`

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
                <p className='text-muted-foreground text-xs'>Full API Key:</p>
                <Input value={fullKey} readOnly className='h-8 font-mono' />
              </div>
            </PopoverContent>
          </Popover>
          <CopyButton
            value={fullKey}
            className='size-7'
            iconClassName='size-3.5'
            tooltip='Copy API key'
            aria-label='Copy API key'
          />
        </div>
      )
    },
    enableSorting: false,
    meta: { label: 'API Key' },
  },
  {
    id: 'quota',
    accessorKey: 'remain_quota',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Quota' />
    ),
    cell: ({ row }) => {
      const apiKey = row.original
      if (apiKey.unlimited_quota) {
        return <Badge variant='outline'>Unlimited</Badge>
      }

      const used = apiKey.used_quota
      const remaining = apiKey.remain_quota
      const total = used + remaining
      const percentage = total > 0 ? (remaining / total) * 100 : 0

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className='w-[150px] space-y-1'>
              <div className='flex justify-between text-xs'>
                <span>{formatQuota(remaining)}</span>
                <span className='text-muted-foreground'>
                  {formatQuota(total)}
                </span>
              </div>
              <Progress value={percentage} className='h-2' />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className='space-y-1 text-xs'>
              <div>Used: {formatQuota(used)}</div>
              <div>Remaining: {formatQuota(remaining)}</div>
              <div>Total: {formatQuota(total)}</div>
              <div>Percentage: {percentage.toFixed(1)}%</div>
            </div>
          </TooltipContent>
        </Tooltip>
      )
    },
    meta: { label: 'Quota' },
  },
  {
    accessorKey: 'group',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Group' />
    ),
    cell: ({ row }) => {
      const group = row.getValue('group') as string
      if (group === 'auto') {
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant='secondary'>Auto</Badge>
            </TooltipTrigger>
            <TooltipContent>
              <span className='text-xs'>
                Automatically selects the best available group with circuit
                breaker mechanism
              </span>
            </TooltipContent>
          </Tooltip>
        )
      }
      return <Badge variant='outline'>{group || 'Default'}</Badge>
    },
    meta: { label: 'Group' },
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
    meta: { label: 'Created' },
  },
  {
    accessorKey: 'expired_time',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Expires' />
    ),
    cell: ({ row }) => {
      const expiredTime = row.getValue('expired_time') as number
      if (expiredTime === -1) {
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
    meta: { label: 'Expires' },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
    meta: { label: 'Actions' },
  },
]
