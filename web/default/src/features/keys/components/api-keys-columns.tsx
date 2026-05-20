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
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { getUserGroups } from '@/lib/api'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { API_KEY_STATUSES } from '../constants'
import { formatKeyQuotaDisplay } from '../lib/format-key-quota'
import {
  keysCheckboxClassName,
  keysColumnHeaderClassName,
  keysTableEmptyClass,
  keysTableMetaClass,
  keysTablePrimaryClass,
  keysTooltipContentClassName,
} from '../lib/keys-ui-styles'
import { type ApiKey } from '../types'
import {
  ApiKeyCell,
  ModelLimitsCell,
  IpRestrictionsCell,
} from './api-keys-cells'
import { DataTableRowActions } from './data-table-row-actions'

function getQuotaProgressColor(percentage: number): string {
  if (percentage <= 10) return '[&_[data-slot=progress-indicator]]:bg-rose-500'
  if (percentage <= 30) return '[&_[data-slot=progress-indicator]]:bg-amber-500'
  return '[&_[data-slot=progress-indicator]]:bg-emerald-500'
}

function useGroupRatios(): Record<string, number> {
  const { data } = useQuery({
    queryKey: ['user-self-groups'],
    queryFn: getUserGroups,
    staleTime: 5 * 60 * 1000,
    select: (res) => {
      if (!res.success || !res.data) return {}
      const ratios: Record<string, number> = {}
      for (const [group, info] of Object.entries(res.data)) {
        if (typeof info.ratio === 'number') {
          ratios[group] = info.ratio
        }
      }
      return ratios
    },
  })

  return data ?? {}
}

export function useApiKeysColumns(): ColumnDef<ApiKey>[] {
  const { t } = useTranslation()
  const groupRatios = useGroupRatios()
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('keys.col.select')}
          className={keysCheckboxClassName}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('keys.col.select')}
          className={keysCheckboxClassName}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { label: t('keys.col.select') },
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.name')}
          className={keysColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => (
        <div
          className={cn(
            'max-w-[200px] truncate font-medium',
            keysTablePrimaryClass
          )}
        >
          {row.getValue('name')}
        </div>
      ),
      meta: { label: t('keys.col.name'), mobileTitle: true },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.status')}
          className={keysColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => {
        const statusConfig = API_KEY_STATUSES[row.getValue('status') as number]
        if (!statusConfig) return null
        return (
          <StatusBadge
            label={t(statusConfig.label)}
            variant={statusConfig.variant}
            showDot={statusConfig.showDot}
            copyable={false}
          />
        )
      },
      filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
      meta: { label: t('keys.col.status'), mobileBadge: true },
    },
    {
      id: 'key',
      accessorKey: 'key',
      header: () => (
        <div className={cn('text-sm font-medium', keysColumnHeaderClassName)}>
          {t('keys.col.access_key')}
        </div>
      ),
      cell: ({ row }) => <ApiKeyCell apiKey={row.original} />,
      enableSorting: false,
      meta: { label: t('keys.col.access_key') },
    },
    {
      id: 'quota',
      accessorKey: 'remain_quota',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.quota')}
          className={keysColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => {
        const apiKey = row.original
        if (apiKey.unlimited_quota) {
          return (
            <StatusBadge
              label={t('keys.quota.unlimited')}
              variant='neutral'
              copyable={false}
            />
          )
        }

        const used = apiKey.used_quota
        const remaining = apiKey.remain_quota
        const total = used + remaining
        const percentage = total > 0 ? (remaining / total) * 100 : 0

        return (
          <Tooltip>
            <TooltipTrigger render={<div className='w-[150px] space-y-1' />}>
              <div className='flex justify-between text-xs'>
                <span
                  className={cn('font-medium tabular-nums', keysTablePrimaryClass)}
                >
                  {formatKeyQuotaDisplay(remaining)}
                </span>
                <span className={cn('tabular-nums', keysTableMetaClass)}>
                  {formatKeyQuotaDisplay(total)}
                </span>
              </div>
              <Progress
                value={percentage}
                className={cn('h-1.5', getQuotaProgressColor(percentage))}
              />
            </TooltipTrigger>
            <TooltipContent className={keysTooltipContentClassName}>
              <div className='space-y-1 text-xs'>
                <div>
                  {t('keys.quota.used')}: {formatKeyQuotaDisplay(used)}
                </div>
                <div>
                  {t('keys.quota.remaining')}: {formatKeyQuotaDisplay(remaining)}{' '}
                  ({percentage.toFixed(1)}%)
                </div>
                <div>
                  {t('keys.quota.total')}: {formatKeyQuotaDisplay(total)}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )
      },
      meta: { label: t('keys.col.quota') },
    },
    {
      accessorKey: 'group',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.group')}
          className={keysColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => {
        const apiKey = row.original
        const group = row.getValue('group') as string
        const ratio = group && group !== 'auto' ? groupRatios[group] : undefined

        if (group === 'auto') {
          return (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className='inline-flex items-center gap-1.5 text-xs' />
                }
              >
                <GroupBadge group='auto' />
                {apiKey.cross_group_retry && (
                  <>
                    <span className={keysTableEmptyClass}>·</span>
                    <span className={keysTableMetaClass}>
                      {t('keys.drawer.cross_group')}
                    </span>
                  </>
                )}
              </TooltipTrigger>
              <TooltipContent className={keysTooltipContentClassName}>
                <span className='text-xs'>{t('keys.drawer.auto_group_hint')}</span>
              </TooltipContent>
            </Tooltip>
          )
        }
        return <GroupBadge group={group} ratio={ratio} />
      },
      meta: { label: t('keys.col.group'), mobileHidden: true },
    },
    {
      id: 'model_limits',
      accessorKey: 'model_limits',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.models')}
          className={keysColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => <ModelLimitsCell apiKey={row.original} />,
      enableSorting: false,
      meta: { label: t('keys.col.models'), mobileHidden: true },
    },
    {
      id: 'allow_ips',
      accessorKey: 'allow_ips',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.ip')}
          className={keysColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => <IpRestrictionsCell apiKey={row.original} />,
      enableSorting: false,
      meta: { label: t('keys.col.ip'), mobileHidden: true },
    },
    {
      accessorKey: 'created_time',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.created')}
          className={keysColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => (
        <span
          className={cn(
            'font-mono text-xs tabular-nums',
            keysTableMetaClass
          )}
        >
          {formatTimestampToDate(row.getValue('created_time'))}
        </span>
      ),
      meta: { label: t('keys.col.created'), mobileHidden: true },
    },
    {
      accessorKey: 'accessed_time',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.last_used')}
          className={keysColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => {
        const accessedTime = row.getValue('accessed_time') as number
        if (!accessedTime) {
          return <span className={keysTableEmptyClass}>-</span>
        }
        return (
          <span
            className={cn(
              'font-mono text-xs tabular-nums',
              keysTableMetaClass
            )}
          >
            {formatTimestampToDate(accessedTime)}
          </span>
        )
      },
      meta: { label: t('keys.col.last_used'), mobileHidden: true },
    },
    {
      accessorKey: 'expired_time',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('keys.col.expires')}
          className={keysColumnHeaderClassName}
        />
      ),
      cell: ({ row }) => {
        const expiredTime = row.getValue('expired_time') as number
        if (expiredTime === -1) {
          return (
            <StatusBadge
              label={t('Never')}
              variant='neutral'
              copyable={false}
            />
          )
        }
        const isExpired = expiredTime * 1000 < Date.now()
        return (
          <span
            className={cn(
              'font-mono text-xs tabular-nums',
              isExpired ? 'text-rose-400' : keysTableMetaClass
            )}
          >
            {formatTimestampToDate(expiredTime)}
          </span>
        )
      },
      meta: { label: t('keys.col.expires'), mobileHidden: true },
    },
    {
      id: 'actions',
      cell: ({ row }) => <DataTableRowActions row={row} />,
      meta: { label: t('keys.col.actions') },
      size: 88,
    },
  ]
}
