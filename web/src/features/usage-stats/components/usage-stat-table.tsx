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

import {
  DataTableColumnHeader,
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import {
  formatNumber,
  formatPercent,
  formatQuota,
  formatTokens,
} from '@/lib/format'

import type { UsageStatDimension, UsageStatItem } from '../types'

type UsageStatTableProps = {
  items: UsageStatItem[]
  dimension: UsageStatDimension
  isLoading?: boolean
  isFetching?: boolean
}

export function UsageStatTable(props: UsageStatTableProps) {
  const { t } = useTranslation()

  const columns = useMemo<ColumnDef<UsageStatItem, unknown>[]>(() => {
    const nameColumn: ColumnDef<UsageStatItem, unknown> =
      props.dimension === 'model'
        ? {
            id: 'model',
            accessorFn: (row) => row.model_name || '',
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title={t('Model')} />
            ),
            cell: ({ row }) => (
              <span className='font-medium'>
                {row.original.model_name || t('Unknown')}
              </span>
            ),
          }
        : {
            id: 'channel',
            accessorFn: (row) => row.channel_name || '',
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title={t('Channel')} />
            ),
            cell: ({ row }) => (
              <span className='flex min-w-0 items-baseline gap-1.5'>
                <span className='truncate font-medium'>
                  {row.original.channel_name ||
                    `channel-${row.original.channel_id ?? 0}`}
                </span>
                <span className='text-muted-foreground font-mono text-xs'>
                  #{row.original.channel_id ?? 0}
                </span>
              </span>
            ),
          }

    const tokenColumn = (
      id: string,
      title: string,
      pick: (row: UsageStatItem) => number
    ): ColumnDef<UsageStatItem, unknown> => ({
      id,
      accessorFn: pick,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={title} />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs tabular-nums'>
          {formatTokens(pick(row.original))}
        </span>
      ),
    })

    return [
      nameColumn,
      tokenColumn(
        'total_tokens',
        t('Total Tokens'),
        (row) => row.input_tokens + row.completion_tokens
      ),
      tokenColumn('cache_tokens', t('Cache Hit'), (row) => row.cache_tokens),
      {
        id: 'cache_hit_rate',
        accessorKey: 'cache_hit_rate',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Cache Hit Rate')} />
        ),
        cell: ({ row }) => {
          const rate = row.original.cache_hit_rate ?? 0
          return (
            <div className='flex items-center gap-2'>
              <div className='bg-muted h-1.5 w-16 shrink-0 overflow-hidden rounded-full'>
                <div
                  className='bg-primary h-full rounded-full'
                  style={{
                    width: `${Math.min(100, Math.max(0, rate * 100))}%`,
                  }}
                />
              </div>
              <span className='font-mono text-xs tabular-nums'>
                {formatPercent(rate * 100)}
              </span>
            </div>
          )
        },
      },
      tokenColumn('miss_tokens', t('Uncached Input'), (row) => row.miss_tokens),
      tokenColumn(
        'completion_tokens',
        t('Output'),
        (row) => row.completion_tokens
      ),
      tokenColumn(
        'cache_creation_tokens',
        t('Cache Write'),
        (row) => row.cache_creation_tokens
      ),
      {
        id: 'count',
        accessorKey: 'count',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Requests')} />
        ),
        cell: ({ row }) => (
          <span className='font-mono text-xs tabular-nums'>
            {formatNumber(row.original.count)}
          </span>
        ),
      },
      {
        id: 'quota',
        accessorKey: 'quota',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Cost')} />
        ),
        cell: ({ row }) => (
          <span className='font-mono text-xs tabular-nums'>
            {formatQuota(row.original.quota)}
          </span>
        ),
      },
    ]
  }, [props.dimension, t])

  const { table } = useDataTable({
    data: props.items,
    columns,
    totalCount: props.items.length,
    withSortedRowModel: true,
    withPaginationRowModel: true,
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={props.isLoading}
      isFetching={props.isFetching}
      emptyTitle={t('No usage in this time range')}
      emptyDescription={t('Try widening the time range.')}
      skeletonKeyPrefix={`usage-stat-${props.dimension}`}
      fixedHeight={false}
    />
  )
}
