import { type ColumnDef } from '@tanstack/react-table'
import { formatQuota } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { StatusBadge } from '@/components/status-badge'
import { USER_STATUSES, USER_ROLES, DEFAULT_GROUP } from '../constants'
import { type User } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export const usersColumns: ColumnDef<User>[] = [
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
    accessorKey: 'username',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Username' />
    ),
    cell: ({ row }) => {
      const username = row.getValue('username') as string
      const remark = row.original.remark

      return (
        <div className='flex items-center gap-2'>
          <LongText className='max-w-[120px] font-medium'>{username}</LongText>
          {remark && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant='outline'
                  className='cursor-help gap-1 text-xs font-normal'
                >
                  <div className='h-2 w-2 rounded-full bg-green-500' />
                  <LongText className='max-w-[80px]'>{remark}</LongText>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className='text-xs'>{remark}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: 'display_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Display Name' />
    ),
    cell: ({ row }) => {
      return (
        <LongText className='max-w-[150px]'>
          {row.getValue('display_name') || '-'}
        </LongText>
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
      const statusConfig =
        USER_STATUSES[statusValue as keyof typeof USER_STATUSES]
      const requestCount = row.original.request_count

      if (!statusConfig) {
        return null
      }

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className='cursor-help'>
              <StatusBadge
                label={statusConfig.label}
                variant={statusConfig.variant}
                showDot={statusConfig.showDot}
                copyable={false}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className='text-xs'>Requests: {requestCount.toLocaleString()}</p>
          </TooltipContent>
        </Tooltip>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(String(row.getValue(id)))
    },
    enableSorting: false,
  },
  {
    id: 'quota',
    accessorKey: 'quota',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Quota' />
    ),
    cell: ({ row }) => {
      const user = row.original
      const used = user.used_quota
      const remaining = user.quota
      const total = used + remaining
      const percentage = total > 0 ? (remaining / total) * 100 : 0

      if (total === 0) {
        return <Badge variant='outline'>No Quota</Badge>
      }

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className='w-[150px] cursor-help space-y-1'>
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
      return <Badge variant='outline'>{group || DEFAULT_GROUP}</Badge>
    },
    filterFn: (row, id, value) => {
      const group = String(row.getValue(id) || DEFAULT_GROUP).toLowerCase()
      const searchValue = String(value).toLowerCase()
      return group.includes(searchValue)
    },
  },
  {
    accessorKey: 'role',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Role' />
    ),
    cell: ({ row }) => {
      const roleValue = row.getValue('role') as number
      const roleConfig = USER_ROLES[roleValue as keyof typeof USER_ROLES]

      if (!roleConfig) {
        return null
      }

      return (
        <div className='flex items-center gap-x-2'>
          {roleConfig.icon && (
            <roleConfig.icon size={16} className='text-muted-foreground' />
          )}
          <span className='text-sm'>{roleConfig.label}</span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(String(row.getValue(id)))
    },
    enableSorting: false,
  },
  {
    id: 'invite_info',
    header: 'Invite Info',
    cell: ({ row }) => {
      const user = row.original
      const affCount = user.aff_count || 0
      const affHistoryQuota = user.aff_history_quota || 0
      const inviterId = user.inviter_id || 0

      return (
        <div className='flex flex-wrap items-center gap-1'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant='secondary' className='cursor-help text-xs'>
                Invited: {affCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className='text-xs'>Number of users invited</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant='secondary' className='cursor-help text-xs'>
                Revenue: {formatQuota(affHistoryQuota)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className='text-xs'>Total invitation revenue</p>
            </TooltipContent>
          </Tooltip>
          {inviterId > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant='outline' className='cursor-help text-xs'>
                  Inviter: {inviterId}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className='text-xs'>Invited by user ID {inviterId}</p>
              </TooltipContent>
            </Tooltip>
          )}
          {inviterId === 0 && (
            <Badge variant='outline' className='text-xs'>
              No Inviter
            </Badge>
          )}
        </div>
      )
    },
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
