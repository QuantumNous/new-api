/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { BadgeCell } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { LongText } from '@/components/long-text'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatQuota, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  USER_STATUS,
  USER_STATUSES,
  USER_ROLES,
  isUserDeleted,
} from '../constants'
import type { User } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

function getQuotaProgressColor(percentage: number): string {
  if (percentage <= 10) {
    return '[&_[data-slot=progress-indicator]]:bg-destructive'
  }
  if (percentage <= 30) {
    return '[&_[data-slot=progress-indicator]]:bg-warning'
  }
  return '[&_[data-slot=progress-indicator]]:bg-success'
}

export function useUsersColumns(): ColumnDef<User>[] {
  const { t } = useTranslation()
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
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
      size: 40,
    },
    {
      accessorKey: 'id',
      header: t('ID'),
      cell: ({ row }) => {
        return (
          <TableId
            value={row.getValue('id') as number}
            className='w-[60px] text-sm'
          />
        )
      },
      size: 80,
      meta: {
        cardRole: 'primary',
        cardOrder: 10,
        cardSpan: 2,
        contentMode: 'full',
      },
    },
    {
      accessorKey: 'username',
      header: t('Username'),
      cell: ({ row }) => {
        const username = row.getValue('username') as string
        const displayName = row.original.display_name
        const remark = row.original.remark

        return (
          <div className='flex min-w-0 flex-col gap-1 sm:min-w-[160px]'>
            <div className='flex flex-wrap items-center gap-2'>
              <LongText className='max-w-full font-medium sm:max-w-[140px]'>
                {username}
              </LongText>
              {remark && (
                <Tooltip>
                  <TooltipTrigger render={<StatusBadge variant='success' />}>
                    {remark}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className='text-xs'>{remark}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {displayName && displayName !== username && (
              <LongText className='text-muted-foreground max-w-full text-xs sm:max-w-[180px]'>
                {displayName}
              </LongText>
            )}
          </div>
        )
      },
      enableHiding: false,
      size: 220,
      meta: {
        cardRole: 'title',
        cardSpan: 2,
        contentMode: 'wrap',
      },
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => {
        const user = row.original
        const requestCount = user.request_count

        const statusConfig = isUserDeleted(user)
          ? USER_STATUSES[USER_STATUS.DELETED]
          : USER_STATUSES[user.status as keyof typeof USER_STATUSES]

        if (!statusConfig) {
          return null
        }

        return (
          <Tooltip>
            <TooltipTrigger render={<div className='cursor-help' />}>
              <StatusBadge variant={statusConfig.variant}>
                {t(statusConfig.labelKey)}
              </StatusBadge>
            </TooltipTrigger>
            <TooltipContent>
              <p className='text-xs'>
                {t('Requests:')} {requestCount.toLocaleString()}
              </p>
            </TooltipContent>
          </Tooltip>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(String(row.getValue(id)))
      },
      enableSorting: false,
      size: 120,
      meta: { cardRole: 'badge', contentMode: 'wrap' },
    },
    {
      id: 'quota',
      accessorKey: 'quota',
      header: t('Quota'),
      cell: ({ row }) => {
        const user = row.original
        const used = user.used_quota
        const remaining = user.quota
        const total = used + remaining
        const percentage = total > 0 ? (remaining / total) * 100 : 0

        if (total === 0) {
          return <StatusBadge variant='neutral'>{t('No Quota')}</StatusBadge>
        }

        return (
          <Tooltip>
            <TooltipTrigger
              render={
                <div className='w-full cursor-help space-y-1 sm:w-[150px]' />
              }
            >
              <div className='flex justify-between text-xs'>
                <span className='font-medium tabular-nums'>
                  {formatQuota(remaining)}
                </span>
                <span className='text-muted-foreground tabular-nums'>
                  {formatQuota(total)}
                </span>
              </div>
              <Progress
                value={percentage}
                className={cn('h-1.5', getQuotaProgressColor(percentage))}
              />
            </TooltipTrigger>
            <TooltipContent>
              <div className='space-y-1 text-xs'>
                <div>
                  {t('Used:')} {formatQuota(used)}
                </div>
                <div>
                  {t('Remaining:')} {formatQuota(remaining)}
                </div>
                <div>
                  {t('Total:')} {formatQuota(total)}
                </div>
                <div>
                  {t('Percentage:')} {percentage.toFixed(1)}%
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )
      },
      size: 170,
      meta: {
        cardRole: 'primary',
        cardOrder: 40,
        cardSpan: 2,
        contentMode: 'full',
      },
    },
    {
      accessorKey: 'group',
      header: t('Group'),
      cell: ({ row }) => {
        const group = row.getValue('group') as string
        return (
          <BadgeCell>
            <GroupBadge group={group} />
          </BadgeCell>
        )
      },
      filterFn: (row, id, value) => {
        const group = String(row.getValue(id) || t('User Group')).toLowerCase()
        const searchValue = String(value).toLowerCase()
        return group.includes(searchValue)
      },
      size: 140,
      meta: {
        cardRole: 'primary',
        cardOrder: 30,
        contentMode: 'wrap',
      },
    },
    {
      accessorKey: 'role',
      header: t('Role'),
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
            <span className='text-sm'>{t(roleConfig.labelKey)}</span>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(String(row.getValue(id)))
      },
      enableSorting: false,
      size: 120,
      meta: {
        cardRole: 'primary',
        cardOrder: 20,
        contentMode: 'full',
      },
    },
    {
      id: 'invite_info',
      header: t('Invite Info'),
      cell: ({ row }) => {
        const user = row.original
        const affCount = user.aff_count || 0
        const affHistoryQuota = user.aff_history_quota || 0
        const inviterId = user.inviter_id || 0

        return (
          <div className='flex max-w-full min-w-0 flex-wrap items-center gap-1'>
            <Tooltip>
              <TooltipTrigger
                render={
                  <StatusBadge variant='neutral' className='cursor-help'>
                    {t('Invited')}: {affCount}
                  </StatusBadge>
                }
              />
              <TooltipContent>
                <p className='text-xs'>{t('Number of users invited')}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <StatusBadge variant='neutral' className='cursor-help'>
                    {t('Revenue')}: {formatQuota(affHistoryQuota)}
                  </StatusBadge>
                }
              />
              <TooltipContent>
                <p className='text-xs'>{t('Total invitation revenue')}</p>
              </TooltipContent>
            </Tooltip>
            {inviterId > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <StatusBadge variant='neutral' className='cursor-help'>
                      {t('Inviter')}: {inviterId}
                    </StatusBadge>
                  }
                />
                <TooltipContent>
                  <p className='text-xs'>
                    {t('Invited by user ID')} {inviterId}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            {inviterId === 0 && (
              <StatusBadge variant='neutral'>{t('No Inviter')}</StatusBadge>
            )}
          </div>
        )
      },
      size: 240,
      enableSorting: false,
      meta: {
        cardRole: 'secondary',
        cardOrder: 50,
        cardSpan: 2,
        contentMode: 'wrap',
      },
    },
    {
      accessorKey: 'created_at',
      header: t('Created At'),
      cell: ({ row }) => {
        const ts = row.getValue('created_at') as number | undefined
        return (
          <span className='text-muted-foreground text-sm'>
            {ts ? formatTimestamp(ts) : '-'}
          </span>
        )
      },
      size: 180,
      meta: {
        cardRole: 'secondary',
        cardOrder: 60,
        contentMode: 'full',
      },
    },
    {
      accessorKey: 'last_login_at',
      header: t('Last Login'),
      cell: ({ row }) => {
        const ts = row.getValue('last_login_at') as number | undefined
        return (
          <span className='text-muted-foreground text-sm'>
            {ts ? formatTimestamp(ts) : '-'}
          </span>
        )
      },
      size: 180,
      meta: {
        cardRole: 'secondary',
        cardOrder: 70,
        contentMode: 'full',
      },
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => <DataTableRowActions row={row} />,
      meta: { pinned: 'right' as const },
    },
  ]
}
