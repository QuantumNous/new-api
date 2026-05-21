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
import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { API_KEY_STATUSES } from '../constants'
import {
  keysActionsHeaderClassName,
  keysCellCenterClassName,
  keysCheckboxClassName,
  keysHeaderCenterClassName,
  keysHeaderVisualCenterClassName,
  keysTableEmptyClass,
  keysTableMetaClass,
  keysTablePrimaryClass,
} from '../lib/keys-ui-styles'
import { KeysSortableColumnHeader } from './keys-sortable-column-header'
import { type ApiKey } from '../types'
import {
  ApiKeyCell,
  KeysGroupCell,
  KeysQuotaCell,
  IpRestrictionsCell,
  ModelLimitsCell,
} from './api-keys-cells'
import { DataTableRowActions } from './data-table-row-actions'

export function useApiKeysColumns(): ColumnDef<ApiKey>[] {
  const { t } = useTranslation()
  return [
    {
      id: 'select',
      size: 42,
      minSize: 40,
      maxSize: 44,
      header: ({ table }) => (
        <div className={keysCellCenterClassName}>
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label={t('keys.col.select')}
            className={keysCheckboxClassName}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className={keysCellCenterClassName}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={t('keys.col.select')}
            className={keysCheckboxClassName}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { label: t('keys.col.select') },
    },
    {
      accessorKey: 'name',
      size: 180,
      minSize: 170,
      maxSize: 190,
      header: ({ column }) => (
        <KeysSortableColumnHeader column={column} title={t('keys.col.name')} />
      ),
      cell: ({ row }) => (
        <div className={keysCellCenterClassName}>
          <div
            className={cn(
              'max-w-full truncate text-center font-semibold',
              keysTablePrimaryClass
            )}
          >
            {row.getValue('name')}
          </div>
        </div>
      ),
      meta: { label: t('keys.col.name'), mobileTitle: true },
    },
    {
      accessorKey: 'status',
      size: 110,
      minSize: 105,
      maxSize: 115,
      header: ({ column }) => (
        <KeysSortableColumnHeader column={column} title={t('keys.col.status')} />
      ),
      cell: ({ row }) => {
        const statusConfig = API_KEY_STATUSES[row.getValue('status') as number]
        if (!statusConfig) return null
        return (
          <div className={keysCellCenterClassName}>
            <StatusBadge
              label={t(statusConfig.label)}
              variant={statusConfig.variant}
              showDot={statusConfig.showDot}
              copyable={false}
            />
          </div>
        )
      },
      filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
      meta: { label: t('keys.col.status'), mobileBadge: true },
    },
    {
      id: 'key',
      accessorKey: 'key',
      size: 230,
      minSize: 220,
      maxSize: 240,
      header: () => (
        <div className={keysHeaderVisualCenterClassName}>
          <span className='text-center text-sm font-medium text-slate-100'>
            {t('keys.col.access_key')}
          </span>
        </div>
      ),
      cell: ({ row }) => <ApiKeyCell apiKey={row.original} />,
      enableSorting: false,
      meta: { label: t('keys.col.access_key') },
    },
    {
      id: 'quota',
      accessorKey: 'remain_quota',
      size: 200,
      minSize: 190,
      maxSize: 210,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.quota')}
          className={keysHeaderCenterClassName}
        />
      ),
      cell: ({ row }) => (
        <div className={keysCellCenterClassName}>
          <KeysQuotaCell apiKey={row.original} />
        </div>
      ),
      meta: { label: t('keys.col.quota') },
    },
    {
      accessorKey: 'group',
      size: 115,
      minSize: 110,
      maxSize: 120,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.group')}
          className={keysHeaderCenterClassName}
        />
      ),
      cell: ({ row }) => (
        <div className={keysCellCenterClassName}>
          <KeysGroupCell apiKey={row.original} />
        </div>
      ),
      meta: { label: t('keys.col.group'), mobileHidden: true },
    },
    {
      id: 'model_limits',
      accessorKey: 'model_limits',
      size: 140,
      minSize: 130,
      maxSize: 150,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.models')}
          className={keysHeaderCenterClassName}
        />
      ),
      cell: ({ row }) => (
        <div className={keysCellCenterClassName}>
          <ModelLimitsCell apiKey={row.original} />
        </div>
      ),
      enableSorting: false,
      meta: { label: t('keys.col.models'), mobileHidden: true },
    },
    {
      id: 'allow_ips',
      accessorKey: 'allow_ips',
      size: 118,
      minSize: 110,
      maxSize: 125,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.ip')}
          className={keysHeaderCenterClassName}
        />
      ),
      cell: ({ row }) => (
        <div className={keysCellCenterClassName}>
          <IpRestrictionsCell apiKey={row.original} />
        </div>
      ),
      enableSorting: false,
      meta: { label: t('keys.col.ip'), mobileHidden: true },
    },
    {
      accessorKey: 'created_time',
      size: 162,
      minSize: 155,
      maxSize: 170,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.created')}
          className={keysHeaderCenterClassName}
        />
      ),
      cell: ({ row }) => (
        <div className={keysCellCenterClassName}>
          <span
            className={cn(
              'whitespace-nowrap font-mono text-xs tabular-nums',
              keysTablePrimaryClass
            )}
          >
            {formatTimestampToDate(row.getValue('created_time'))}
          </span>
        </div>
      ),
      meta: { label: t('keys.col.created'), mobileHidden: true },
    },
    {
      accessorKey: 'accessed_time',
      size: 162,
      minSize: 155,
      maxSize: 170,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.last_used')}
          className={keysHeaderCenterClassName}
        />
      ),
      cell: ({ row }) => {
        const accessedTime = row.getValue('accessed_time') as number
        return (
          <div className={keysCellCenterClassName}>
            {!accessedTime ? (
              <span className={keysTableEmptyClass}>-</span>
            ) : (
              <span
                className={cn(
                  'whitespace-nowrap font-mono text-xs tabular-nums',
                  keysTablePrimaryClass
                )}
              >
                {formatTimestampToDate(accessedTime)}
              </span>
            )}
          </div>
        )
      },
      meta: { label: t('keys.col.last_used'), mobileHidden: true },
    },
    {
      accessorKey: 'expired_time',
      size: 120,
      minSize: 110,
      maxSize: 130,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.expires')}
          className={keysHeaderCenterClassName}
        />
      ),
      cell: ({ row }) => {
        const expiredTime = row.getValue('expired_time') as number
        return (
          <div className={keysCellCenterClassName}>
            {expiredTime === -1 ? (
              <StatusBadge
                label={t('Never')}
                variant='neutral'
                copyable={false}
              />
            ) : (
              <span
                className={cn(
                  'whitespace-nowrap font-mono text-xs tabular-nums',
                  expiredTime * 1000 < Date.now()
                    ? 'text-rose-300'
                    : keysTablePrimaryClass
                )}
              >
                {formatTimestampToDate(expiredTime)}
              </span>
            )}
          </div>
        )
      },
      meta: { label: t('keys.col.expires'), mobileHidden: true },
    },
    {
      id: 'actions',
      header: () => (
        <div className={keysActionsHeaderClassName}>
          {t('keys.col.actions')}
        </div>
      ),
      cell: ({ row }) => (
        <div className={keysCellCenterClassName}>
          <DataTableRowActions row={row} />
        </div>
      ),
      enableSorting: false,
      meta: { label: t('keys.col.actions') },
      size: 68,
      minSize: 64,
      maxSize: 72,
    },
  ]
}
