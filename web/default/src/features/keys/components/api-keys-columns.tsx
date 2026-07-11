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

import { BadgeCell, TruncatedCell } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useGroupRatios } from '@/hooks/use-group-ratios'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import { API_KEY_STATUSES } from '../constants'
import type { ApiKey } from '../types'
import { ApiKeyTimestampCell } from './api-key-timestamp-cell'
import {
  ApiKeyCell,
  ModelLimitsCell,
  IpRestrictionsCell,
} from './api-keys-cells'
import { DataTableRowActions } from './data-table-row-actions'

/**
 * Inline quota values longer than this switch to locale-aware compact
 * notation (e.g. "¥4.8万"); precise values stay available in the tooltip.
 */
const MAX_INLINE_QUOTA_CHARS = 8

function getQuotaProgressColor(percentage: number): string {
  if (percentage <= 10) {
    return '[&_[data-slot=progress-indicator]]:bg-destructive'
  }
  if (percentage <= 30) return '[&_[data-slot=progress-indicator]]:bg-warning'
  return '[&_[data-slot=progress-indicator]]:bg-success'
}

export function useApiKeysColumns(now: number): ColumnDef<ApiKey>[] {
  const { t, i18n } = useTranslation()
  const groupRatios = useGroupRatios()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const justNowLabel = t('Just now')
  const staleAccessThreshold = dayjs(now).subtract(3, 'month').valueOf()
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
      meta: { cardRole: 'hidden' },
    },
    {
      accessorKey: 'name',
      header: t('Name'),
      cell: ({ row }) => {
        const name = row.getValue('name') as string
        return (
          <span className='block max-w-full truncate font-medium' title={name}>
            {name}
          </span>
        )
      },
      size: 180,
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
        const statusConfig = API_KEY_STATUSES[row.getValue('status') as number]
        if (!statusConfig) return null
        return (
          <StatusBadge variant={statusConfig.variant}>
            {t(statusConfig.label)}
          </StatusBadge>
        )
      },
      filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
      size: 120,
      meta: {
        cardRole: 'secondary',
        cardOrder: 10,
        contentMode: 'full',
      },
    },
    {
      id: 'key',
      accessorKey: 'key',
      header: t('API Key'),
      cell: ({ row }) => <ApiKeyCell apiKey={row.original} />,
      enableSorting: false,
      size: 260,
      meta: {
        cardRole: 'primary',
        cardOrder: 10,
        cardSpan: 2,
        contentMode: 'full',
      },
    },
    {
      id: 'quota',
      accessorKey: 'remain_quota',
      header: t('Quota'),
      cell: ({ row }) => {
        const apiKey = row.original
        if (apiKey.unlimited_quota) {
          return <StatusBadge variant='neutral'>{t('Unlimited')}</StatusBadge>
        }

        const used = apiKey.used_quota
        const remaining = apiKey.remain_quota
        const total = used + remaining
        const percentage = total > 0 ? (remaining / total) * 100 : 0

        const toInlineQuota = (value: number) => {
          const full = formatQuota(value)
          if (full.length <= MAX_INLINE_QUOTA_CHARS) {
            return full
          }
          return formatQuotaWithCurrency(value, { compact: true, locale })
        }

        return (
          <Tooltip>
            <TooltipTrigger render={<div className='w-[150px] space-y-1' />}>
              <div className='flex justify-between gap-2 text-xs'>
                <span className='truncate font-medium tabular-nums'>
                  {toInlineQuota(remaining)}
                </span>
                <span className='text-muted-foreground truncate tabular-nums'>
                  {toInlineQuota(total)}
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
                  {t('Remaining:')} {formatQuota(remaining)} (
                  {percentage.toFixed(1)}%)
                </div>
                <div>
                  {t('Total:')} {formatQuota(total)}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )
      },
      size: 170,
      meta: {
        cardRole: 'primary',
        cardOrder: 20,
        cardSpan: 2,
        contentMode: 'full',
      },
    },
    {
      accessorKey: 'group',
      header: t('Group'),
      cell: ({ row }) => {
        const apiKey = row.original
        const group = row.getValue('group') as string
        const ratio = group && group !== 'auto' ? groupRatios[group] : undefined

        if (group === 'auto') {
          return (
            <Tooltip>
              <TooltipTrigger
                render={<BadgeCell className='gap-1.5 text-xs' />}
              >
                <GroupBadge group='auto' />
                {apiKey.cross_group_retry && (
                  <StatusBadge variant='info'>{t('Cross-group')}</StatusBadge>
                )}
              </TooltipTrigger>
              <TooltipContent>
                <span className='text-xs'>
                  {t(
                    'Automatically selects the best available group with circuit breaker mechanism'
                  )}
                </span>
              </TooltipContent>
            </Tooltip>
          )
        }
        return (
          <TruncatedCell
            tooltipContent={group || '-'}
            tooltipClassName='break-all'
          >
            <GroupBadge group={group} ratio={ratio} />
          </TruncatedCell>
        )
      },
      size: 160,
      meta: {
        cardRole: 'secondary',
        cardOrder: 20,
        cardSpan: 2,
        contentMode: 'full',
      },
    },
    {
      id: 'model_limits',
      accessorKey: 'model_limits',
      header: t('Models'),
      cell: ({ row }) => <ModelLimitsCell apiKey={row.original} />,
      enableSorting: false,
      size: 160,
      meta: {
        cardRole: 'secondary',
        cardOrder: 30,
        cardSpan: 2,
        contentMode: 'full',
      },
    },
    {
      id: 'allow_ips',
      accessorKey: 'allow_ips',
      header: t('IP Restriction'),
      cell: ({ row }) => <IpRestrictionsCell apiKey={row.original} />,
      enableSorting: false,
      size: 160,
      meta: {
        cardRole: 'secondary',
        cardOrder: 40,
        cardSpan: 2,
        contentMode: 'full',
      },
    },
    {
      accessorKey: 'created_time',
      header: t('Created'),
      cell: ({ row }) => (
        <ApiKeyTimestampCell
          timestamp={row.getValue('created_time')}
          now={now}
          locale={locale}
          justNowLabel={justNowLabel}
          className='text-muted-foreground'
        />
      ),
      size: 180,
      meta: {
        cardRole: 'secondary',
        cardOrder: 50,
        contentMode: 'full',
      },
    },
    {
      accessorKey: 'accessed_time',
      header: t('Last Used'),
      cell: ({ row }) => {
        const accessedTime = row.getValue('accessed_time') as number
        const isStale =
          accessedTime > 0 && accessedTime * 1000 < staleAccessThreshold

        return (
          <ApiKeyTimestampCell
            timestamp={accessedTime}
            now={now}
            locale={locale}
            justNowLabel={justNowLabel}
            className={isStale ? 'text-warning' : 'text-muted-foreground'}
          />
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
      accessorKey: 'expired_time',
      header: t('Expires'),
      cell: ({ row }) => {
        const expiredTime = row.getValue('expired_time') as number
        if (expiredTime === -1) {
          return <StatusBadge variant='neutral'>{t('Never')}</StatusBadge>
        }
        const isExpired = expiredTime * 1000 < now
        return (
          <ApiKeyTimestampCell
            timestamp={expiredTime}
            now={now}
            locale={locale}
            justNowLabel={justNowLabel}
            className={cn(
              isExpired ? 'text-destructive' : 'text-muted-foreground'
            )}
          />
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
      meta: {
        pinned: 'right' as const,
        cardRole: 'secondary',
        cardOrder: 80,
        cardSpan: 2,
        contentMode: 'full',
      },
    },
  ]
}
