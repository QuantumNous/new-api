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
import { formatTimestampToDate } from '@/lib/format'

import {
  SLA_INCIDENT_SEVERITY_CONFIG,
  SLA_INCIDENT_STATUS_CONFIG,
} from '../constants'
import type { SlaIncident } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export function useSlaIncidentsColumns(): ColumnDef<SlaIncident>[] {
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
      accessorKey: 'title',
      header: t('Title'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <span className='font-medium'>{row.getValue('title')}</span>
      ),
      size: 240,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const statusValue = row.getValue('status') as number
        const config = SLA_INCIDENT_STATUS_CONFIG[statusValue]
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
      filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
      size: 130,
    },
    {
      accessorKey: 'severity',
      header: t('Severity'),
      cell: ({ row }) => {
        const severity = row.getValue('severity') as string
        const config = SLA_INCIDENT_SEVERITY_CONFIG[severity]
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
      size: 120,
    },
    {
      accessorKey: 'started_at',
      header: t('Started'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const value = row.getValue('started_at') as number
        return (
          <div className='min-w-[140px] font-mono text-sm'>
            {value > 0 ? formatTimestampToDate(value) : '-'}
          </div>
        )
      },
      size: 160,
    },
    {
      accessorKey: 'resolved_at',
      header: t('Resolved'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const value = row.getValue('resolved_at') as number
        return (
          <div className='min-w-[140px] font-mono text-sm'>
            {value > 0 ? formatTimestampToDate(value) : '-'}
          </div>
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
