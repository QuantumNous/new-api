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
import { toIntlLocale } from '@/i18n/languages'
import { getUserGroups } from '@/lib/api'
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

function getQuotaProgressColor(percentage: number): string {
  if (percentage <= 10) return '[&_[data-slot=progress-indicator]]:bg-rose-500'
  if (percentage <= 30) return '[&_[data-slot=progress-indicator]]:bg-amber-500'
  return '[&_[data-slot=progress-indicator]]:bg-emerald-500'
}

function useGroupRatios(): Record<string, number> {
  const { data } = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
    staleTime: 0,
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

/**
 * API Keys list columns.
 *
 * Primary (always on): select · name+status · key · remaining · actions
 * Secondary/detail (hidden by default, enable via Columns or Details menu):
 * used, group, models, IP, created, last used, expires.
 *
 * This keeps the default table within a typical desktop/laptop width so
 * users do not need horizontal scrolling for day-to-day key management.
 */
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
      meta: { priority: 'primary' },
    },
    {
      accessorKey: 'name',
      header: t('Name'),
      cell: ({ row }) => {
        const statusConfig = API_KEY_STATUSES[row.original.status]
        return (
          <div className='flex min-w-0 items-center gap-2'>
            <span className='text-foreground min-w-0 truncate text-sm font-medium'>
              {row.getValue('name')}
            </span>
            {statusConfig && (
              <StatusBadge
                label={t(statusConfig.label)}
                variant={statusConfig.variant}
                copyable={false}
                type='text'
                className='shrink-0 text-xs'
              />
            )}
          </div>
        )
      },
      size: 220,
      meta: { priority: 'primary', mobileTitle: true, label: t('Name') },
    },
    {
      // Kept for filtering / view-options; merged into Name for default display.
      accessorKey: 'status',
      header: t('Status'),
      cell: ({ row }) => {
        const statusConfig = API_KEY_STATUSES[row.getValue('status') as number]
        if (!statusConfig) return null
        return (
          <StatusBadge
            label={t(statusConfig.label)}
            variant={statusConfig.variant}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
      size: 100,
      meta: {
        priority: 'secondary',
        mobileBadge: true,
        mobileHidden: true,
      },
    },
    {
      id: 'key',
      accessorKey: 'key',
      header: t('Key'),
      cell: ({ row }) => <ApiKeyCell apiKey={row.original} />,
      enableSorting: false,
      size: 200,
      meta: { priority: 'primary' },
    },
    {
      id: 'remain_quota',
      accessorKey: 'remain_quota',
      header: t('Quota'),
      cell: ({ row }) => {
        const apiKey = row.original
        if (apiKey.unlimited_quota) {
          return (
            <StatusBadge
              label={t('Follow user')}
              variant='neutral'
              copyable={false}
              className='-ml-1.5'
            />
          )
        }

        const used = apiKey.used_quota
        const remaining = apiKey.remain_quota
        const total = used + remaining
        const percentage = total > 0 ? (remaining / total) * 100 : 0

        return (
          <Tooltip>
            <TooltipTrigger
              render={<div className='w-full max-w-[140px] space-y-1' />}
            >
              <div className='font-mono text-xs font-medium tabular-nums'>
                {formatQuota(remaining)}
                <span className='text-muted-foreground font-normal'>
                  {' / '}
                  {formatQuota(total)}
                </span>
              </div>
              <Progress
                value={percentage}
                className={cn('h-1', getQuotaProgressColor(percentage))}
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
              </div>
            </TooltipContent>
          </Tooltip>
        )
      },
      size: 150,
      meta: { priority: 'primary' },
    },
    {
      id: 'used_quota',
      accessorKey: 'used_quota',
      header: t('Used quota'),
      cell: ({ row }) => (
        <span className='font-mono text-xs tabular-nums'>
          {formatQuota(row.original.used_quota)}
        </span>
      ),
      size: 110,
      meta: { priority: 'detail', mobileHidden: true },
    },
    {
      accessorKey: 'group',
      header: t('Channel group'),
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
                  <StatusBadge
                    label={t('Cross-group')}
                    variant='info'
                    copyable={false}
                  />
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
            className='-ml-1.5'
            tooltipContent={group || '-'}
            tooltipClassName='break-all'
          >
            <GroupBadge group={group} ratio={ratio} />
          </TruncatedCell>
        )
      },
      size: 140,
      meta: { priority: 'secondary', mobileHidden: true },
    },
    {
      id: 'model_limits',
      accessorKey: 'model_limits',
      header: t('Models'),
      cell: ({ row }) => <ModelLimitsCell apiKey={row.original} />,
      enableSorting: false,
      size: 140,
      meta: { priority: 'detail', mobileHidden: true },
    },
    {
      id: 'allow_ips',
      accessorKey: 'allow_ips',
      header: t('IP Restriction'),
      cell: ({ row }) => <IpRestrictionsCell apiKey={row.original} />,
      enableSorting: false,
      size: 140,
      meta: { priority: 'detail', mobileHidden: true },
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
      size: 140,
      meta: { priority: 'detail', mobileHidden: true },
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
      size: 140,
      meta: { priority: 'secondary', mobileHidden: true },
    },
    {
      accessorKey: 'expired_time',
      header: t('Expires'),
      cell: ({ row }) => {
        const expiredTime = row.getValue('expired_time') as number
        if (expiredTime === -1) {
          return (
            <StatusBadge
              label={t('Never')}
              variant='neutral'
              copyable={false}
              className='-ml-1.5'
            />
          )
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
      size: 140,
      meta: { priority: 'secondary', mobileHidden: true },
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => <DataTableRowActions row={row} />,
      enableHiding: false,
      size: 100,
      meta: { priority: 'primary', pinned: 'right' as const },
    },
  ]
}
