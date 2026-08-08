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
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Checkbox } from '@/components/ui/checkbox'

import { REGION_ROUTE_STRATEGY_CONFIG } from '../constants'
import type { RegionRoute } from '../types'
import { splitChannelIds } from '../lib'
import { DataTableRowActions } from './data-table-row-actions'

export function useRegionRoutesColumns(
  channelNameById: Record<number, string>
): ColumnDef<RegionRoute>[] {
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
      cell: ({ row }) => {
        return (
          <TableId value={row.getValue('id') as number} className='w-[60px]' />
        )
      },
      size: 80,
    },
    {
      accessorKey: 'region',
      header: t('Region'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <span className='font-medium'>{row.getValue('region')}</span>
      ),
      size: 120,
    },
    {
      accessorKey: 'model',
      header: t('Model'),
      cell: ({ row }) => {
        const model = row.getValue('model') as string
        return <span className='font-mono text-sm'>{model || '*'}</span>
      },
      size: 160,
    },
    {
      accessorKey: 'channel_ids',
      header: t('Channels'),
      cell: ({ row }) => {
        const ids = splitChannelIds(row.getValue('channel_ids') as string)
        if (ids.length === 0) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }
        const labels = ids.map(
          (id) => channelNameById[id] ?? `#${id}`
        )
        return (
          <span className='text-sm' title={labels.join(', ')}>
            {labels.slice(0, 3).join(', ')}
            {labels.length > 3 ? ` +${labels.length - 3}` : ''}
          </span>
        )
      },
      size: 220,
    },
    {
      accessorKey: 'tag',
      header: t('Tag'),
      cell: ({ row }) => {
        const tag = row.getValue('tag') as string
        return tag ? (
          <span className='text-sm'>{tag}</span>
        ) : (
          <span className='text-muted-foreground text-sm'>-</span>
        )
      },
      size: 120,
    },
    {
      accessorKey: 'strategy',
      header: t('Strategy'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const strategy = row.getValue('strategy') as string
        const config = REGION_ROUTE_STRATEGY_CONFIG[strategy]
        if (!config) return null
        return (
          <StatusBadge
            label={t(config.labelKey)}
            variant={config.variant}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 130,
    },
    {
      accessorKey: 'priority',
      header: t('Priority'),
      cell: ({ row }) => (
        <span className='tabular-nums'>{row.getValue('priority') as number}</span>
      ),
      size: 100,
    },
    {
      accessorKey: 'weight',
      header: t('Weight'),
      cell: ({ row }) => (
        <span className='tabular-nums'>{row.getValue('weight') as number}</span>
      ),
      size: 100,
    },
    {
      accessorKey: 'enabled',
      header: t('Enabled'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const enabled = row.getValue('enabled') as boolean
        return (
          <StatusBadge
            label={t(enabled ? 'Enabled' : 'Disabled')}
            variant={enabled ? 'success' : 'neutral'}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 110,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => <DataTableRowActions row={row} />,
      meta: { pinned: 'right' as const },
    },
  ]
}
