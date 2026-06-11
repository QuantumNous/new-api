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
import { useTranslation } from 'react-i18next'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { Checkbox } from '@/components/ui/checkbox'
import { type Combo } from '../types'
import { CombosRowActions } from './combos-row-actions'
import { StrategyCell, StatusCell } from './combos-cells'

export function useCombosColumns(): ColumnDef<Combo>[] {
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
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('Select row')}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Name')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[300px] truncate font-medium'>
          {row.getValue('name')}
        </div>
      ),
      enableSorting: true,
      enableHiding: false,
      size: 200,
    },
    {
      accessorKey: 'models',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Models')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[260px] truncate text-sm text-muted-foreground'>
          {row.getValue('models')}
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 220,
    },
    {
      accessorKey: 'strategy',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Strategy')} />
      ),
      cell: ({ row }) => <StrategyCell combo={row.original} />,
      enableSorting: true,
      enableHiding: false,
      size: 140,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Status')} />
      ),
      cell: ({ row }) => <StatusCell combo={row.original} />,
      enableSorting: true,
      enableHiding: false,
      size: 120,
    },
    {
      accessorKey: 'created_time',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Created At')} />
      ),
      cell: ({ row }) => {
        const time = row.getValue('created_time') as number | null
        if (time == null) return '-'
        return new Date(time * 1000).toLocaleString()
      },
      enableSorting: true,
      enableHiding: false,
      size: 160,
    },
    {
      id: 'actions',
      header: () => <div className='text-right'>{t('Actions')}</div>,
      cell: ({ row }) => <CombosRowActions row={row} />,
      enableSorting: false,
      enableHiding: false,
      size: 80,
    },
  ]
}
