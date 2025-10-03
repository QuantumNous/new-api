import { type ColumnDef } from '@tanstack/react-table'
import { Eye, EyeOff } from 'lucide-react'
import { formatQuota, formatTimestamp } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
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
import { useApiKeys } from './api-keys-provider'
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
  },
  {
    id: 'key',
    accessorKey: 'key',
    header: 'API Key',
    cell: function KeyCell({ row }) {
      const { visibleKeys, setVisibleKeys } = useApiKeys()
      const apiKey = row.original
      const isVisible = visibleKeys[apiKey.id] || false
      const fullKey = `sk-${apiKey.key}`
      const maskedKey = `sk-${apiKey.key.slice(0, 4)}${'*'.repeat(10)}${apiKey.key.slice(-4)}`

      return (
        <div className='relative w-[200px] rounded-md'>
          <Input
            value={isVisible ? fullKey : maskedKey}
            readOnly
            className='h-8 w-full pr-[72px] font-mono text-xs'
          />
          <div className='absolute end-1 top-1/2 flex -translate-y-1/2 items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='size-6 rounded-md'
              onClick={() =>
                setVisibleKeys((prev) => ({ ...prev, [apiKey.id]: !isVisible }))
              }
            >
              {isVisible ? (
                <EyeOff className='size-4' />
              ) : (
                <Eye className='size-4' />
              )}
            </Button>
            <CopyButton
              value={fullKey}
              className='size-6'
              iconClassName='size-4'
              tooltip='Copy API key'
              aria-label='Copy API key'
            />
          </div>
        </div>
      )
    },
    enableSorting: false,
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
  },
  {
    accessorKey: 'created_time',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Created' />
    ),
    cell: ({ row }) => {
      return (
        <div className='text-muted-foreground'>
          {formatTimestamp(row.getValue('created_time'))}
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
      if (expiredTime === -1) {
        return <Badge variant='outline'>Never</Badge>
      }
      const isExpired = expiredTime * 1000 < Date.now()
      return (
        <div
          className={`${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {formatTimestamp(expiredTime)}
        </div>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
