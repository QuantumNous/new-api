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
*/
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'
import { formatTimestampToDate } from '@/lib/format'

import type { Team } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export function useTeamsColumns(): ColumnDef<Team>[] {
  const { t } = useTranslation()
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
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
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <TableId value={row.getValue('id') as number} className='w-[60px]' />
      ),
      size: 80,
    },
    {
      accessorKey: 'name',
      header: t('Name'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <Link
          to='/teams/$teamId'
          params={{ teamId: String(row.original.id) }}
          className='font-medium hover:underline'
        >
          {row.getValue('name')}
        </Link>
      ),
      size: 180,
    },
    {
      accessorKey: 'description',
      header: t('Description'),
      cell: ({ row }) => {
        const description = row.getValue('description') as string
        return description ? (
          <span className='text-sm' title={description}>
            {description}
          </span>
        ) : (
          <span className='text-muted-foreground text-sm'>-</span>
        )
      },
      size: 260,
    },
    {
      accessorKey: 'owner_id',
      header: t('Owner User ID'),
      cell: ({ row }) => (
        <span className='tabular-nums'>
          {row.getValue('owner_id') as number}
        </span>
      ),
      size: 120,
    },
    {
      accessorKey: 'created_at',
      header: t('Created At'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const createdAt = row.getValue('created_at') as number
        return (
          <span className='text-muted-foreground text-sm'>
            {createdAt > 0 ? formatTimestampToDate(createdAt) : '-'}
          </span>
        )
      },
      size: 160,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => <DataTableRowActions row={row} />,
      meta: { pinned: 'right' as const },
    },
  ]
}
