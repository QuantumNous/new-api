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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ActivityTimeCell } from '@/components/activity-time-cell'
import { BadgeCell } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  USER_STATUS,
  USER_STATUSES,
  USER_ROLES,
  isUserDeleted,
} from '../constants'
import type { User } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export function useUsersColumns(): ColumnDef<User>[] {
  const { t } = useTranslation()
  return useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label={t('Select all')}
            className='translate-y-[2px]'
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={t('Select row')}
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
              className='w-[60px] [font-family:inherit] text-sm'
            />
          )
        },
        size: 80,
        meta: { mobileOrder: 10 },
      },
      {
        accessorKey: 'username',
        header: t('Username'),
        cell: ({ row }) => {
          const username = row.getValue('username') as string
          const displayName = row.original.display_name
          const remark = row.original.remark

          return (
            <div className='flex min-w-[160px] flex-col gap-1'>
              <div className='flex items-center gap-2'>
                <LongText className='max-w-[140px] text-sm font-normal'>
                  {username}
                </LongText>
                {remark && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <StatusBadge
                          variant='success'
                          copyable={false}
                          className='font-normal'
                        />
                      }
                    >
                      <LongText className='max-w-[80px]'>{remark}</LongText>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className='text-xs'>{remark}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {displayName && displayName !== username && (
                <div
                  data-table-text='secondary'
                  className='text-muted-foreground max-w-[180px] text-xs font-normal'
                >
                  <LongText>{displayName}</LongText>
                </div>
              )}
            </div>
          )
        },
        enableHiding: false,
        size: 220,
        meta: { mobileTitle: true },
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => {
          const user = row.original
          const statusConfig = isUserDeleted(user)
            ? USER_STATUSES[USER_STATUS.DELETED]
            : USER_STATUSES[user.status as keyof typeof USER_STATUSES]

          if (!statusConfig) {
            return null
          }

          return (
            <Tooltip>
              <TooltipTrigger render={<div className='-ml-1.5 cursor-help' />}>
                <StatusBadge
                  label={t(statusConfig.labelKey)}
                  variant={
                    isUserDeleted(user) ? 'neutral' : statusConfig.variant
                  }
                  copyable={false}
                  className='font-normal'
                />
              </TooltipTrigger>
            </Tooltip>
          )
        },
        filterFn: (row, id, value) => {
          return value.includes(String(row.getValue(id)))
        },
        enableSorting: false,
        size: 120,
        meta: { mobileBadge: true },
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

          return <span className='text-sm'>{t(roleConfig.labelKey)}</span>
        },
        filterFn: (row, id, value) => {
          return value.includes(String(row.getValue(id)))
        },
        enableSorting: false,
        size: 120,
        meta: { mobileOrder: 20 },
      },
      {
        accessorKey: 'created_at',
        header: t('Time'),
        cell: ({ row }) => (
          <ActivityTimeCell
            createdAt={row.original.created_at ?? 0}
            lastAt={row.original.last_login_at ?? 0}
            lastLabel={t('Last Login')}
            format='absolute'
          />
        ),
        size: 260,
        minSize: 240,
        meta: { mobileHidden: true },
      },
      {
        id: 'actions',
        header: () => t('Actions'),
        cell: ({ row }) => <DataTableRowActions row={row} />,
        meta: { pinned: 'right' as const },
      },
    ],
    [t]
  )
}
