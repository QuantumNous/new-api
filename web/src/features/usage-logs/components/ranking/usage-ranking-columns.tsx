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
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  formatCompactNumber,
  formatQuota,
  formatTimestampToDate,
  formatUseTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'

import type { UsageRankingItem } from '../../types'

interface UseUsageRankingColumnsOptions {
  expandedRows: Set<string>
  onToggleRow: (rowKey: string) => void
}

export function getUsageRankingRowKey(item: UsageRankingItem): string {
  return `${item.user_id}:${item.username}`
}

export function formatUsageRankingRatio(value: number): string {
  return Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0)
}

export function renderUsageRankingRank(rank: number) {
  let variant: 'default' | 'secondary' | 'outline' = 'outline'
  if (rank === 1) {
    variant = 'default'
  } else if (rank <= 10) {
    variant = 'secondary'
  }
  return (
    <Badge variant={variant}>{rank <= 10 ? `Top ${rank}` : `#${rank}`}</Badge>
  )
}

export function useUsageRankingColumns(
  options: UseUsageRankingColumnsOptions
): ColumnDef<UsageRankingItem, unknown>[] {
  const { t } = useTranslation()
  const expandedRows = options.expandedRows
  const onToggleRow = options.onToggleRow

  return useMemo(
    () => [
      {
        id: 'expand',
        size: 42,
        header: () => <span className='sr-only'>{t('Group Breakdown')}</span>,
        cell: ({ row }) => {
          const rowKey = getUsageRankingRowKey(row.original)
          const expanded = expandedRows.has(rowKey)
          const expandable = row.original.group_stats.length > 0
          return expandable ? (
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              aria-label={expanded ? t('Collapse') : t('Expand')}
              aria-expanded={expanded}
              onClick={() => onToggleRow(rowKey)}
            >
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className={cn(
                  'transition-transform duration-200',
                  expanded && 'rotate-180'
                )}
              />
            </Button>
          ) : null
        },
      },
      {
        accessorKey: 'rank',
        header: t('Rank'),
        size: 88,
        cell: ({ row }) => renderUsageRankingRank(row.original.rank),
      },
      {
        accessorKey: 'username',
        header: t('User'),
        size: 180,
        cell: ({ row }) => (
          <div className='flex min-w-0 flex-col'>
            <span className='max-w-40 truncate font-medium'>
              {row.original.username || '-'}
            </span>
            <span className='text-muted-foreground text-xs'>
              ID: {row.original.user_id}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'quota',
        header: t('Consumed Quota'),
        cell: ({ row }) => (
          <span className='font-medium'>{formatQuota(row.original.quota)}</span>
        ),
      },
      {
        accessorKey: 'request_count',
        header: t('Request Count'),
        cell: ({ row }) => formatCompactNumber(row.original.request_count),
      },
      {
        accessorKey: 'total_tokens',
        header: t('Total Tokens'),
        cell: ({ row }) => formatCompactNumber(row.original.total_tokens),
      },
      {
        accessorKey: 'prompt_tokens',
        header: t('Input Tokens'),
        cell: ({ row }) => formatCompactNumber(row.original.prompt_tokens),
      },
      {
        accessorKey: 'completion_tokens',
        header: t('Output Tokens'),
        cell: ({ row }) => formatCompactNumber(row.original.completion_tokens),
      },
      {
        accessorKey: 'avg_use_time',
        header: t('Average Duration'),
        cell: ({ row }) => formatUseTime(row.original.avg_use_time),
      },
      {
        accessorKey: 'error_rate',
        header: t('Error Rate'),
        cell: ({ row }) => (
          <div className='flex items-center justify-end gap-1'>
            <span>{formatUsageRankingRatio(row.original.error_rate)}</span>
            {row.original.error_count > 0 && (
              <Badge variant='destructive'>
                {formatCompactNumber(row.original.error_count)}
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'stream_ratio',
        header: t('Stream Ratio'),
        cell: ({ row }) => formatUsageRankingRatio(row.original.stream_ratio),
      },
      {
        accessorKey: 'model_count',
        header: t('Models'),
        cell: ({ row }) => formatCompactNumber(row.original.model_count),
      },
      {
        accessorKey: 'token_count',
        header: t('Tokens'),
        cell: ({ row }) => formatCompactNumber(row.original.token_count),
      },
      {
        accessorKey: 'group_count',
        header: t('Groups'),
        cell: ({ row }) => formatCompactNumber(row.original.group_count),
      },
      {
        accessorKey: 'channel_count',
        header: t('Channels'),
        cell: ({ row }) => formatCompactNumber(row.original.channel_count),
      },
      {
        accessorKey: 'last_used_at',
        header: t('Latest Request Time'),
        size: 176,
        cell: ({ row }) => formatTimestampToDate(row.original.last_used_at),
      },
    ],
    [expandedRows, onToggleRow, t]
  )
}
