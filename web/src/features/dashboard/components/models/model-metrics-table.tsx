/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { ArrowDownUp, ChevronDown, ChevronUp, Gauge } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  staticDataTableClassNames as tableStyles,
} from '@/components/data-table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  buildModelMetrics,
  getDashboardDurationMinutes,
} from '@/features/dashboard/lib'
import type {
  DashboardFilters,
  ModelMetric,
  QuotaDataItem,
} from '@/features/dashboard/types'
import { formatCompactNumber, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

type SortKey =
  | 'modelName'
  | 'requestCount'
  | 'totalTokens'
  | 'averageRpm'
  | 'averageTpm'

type SortDirection = 'asc' | 'desc'

const SORT_KEYS: Record<SortKey, string> = {
  modelName: 'Model',
  requestCount: 'Requests',
  totalTokens: 'Tokens',
  averageRpm: 'Average RPM',
  averageTpm: 'Average TPM',
}

function compareMetric(
  left: ModelMetric,
  right: ModelMetric,
  sortKey: SortKey
): number {
  if (sortKey === 'modelName') {
    return left.modelName.localeCompare(right.modelName)
  }

  const leftValue = left[sortKey]
  const rightValue = right[sortKey]
  const normalizedLeft = leftValue ?? -1
  const normalizedRight = rightValue ?? -1

  return normalizedLeft - normalizedRight
}

function SortableHeader(props: {
  label: string
  sortKey: SortKey
  activeSortKey: SortKey
  direction: SortDirection
  onSort: (sortKey: SortKey) => void
  align?: 'left' | 'right'
}) {
  const { t } = useTranslation()
  const isActive = props.sortKey === props.activeSortKey
  let Icon = ArrowDownUp
  if (isActive) {
    Icon = props.direction === 'asc' ? ChevronUp : ChevronDown
  }

  return (
    <button
      type='button'
      className={cn(
        'text-muted-foreground inline-flex items-center gap-1 text-[10px] font-medium tracking-wider uppercase',
        props.align === 'right' && 'ml-auto'
      )}
      aria-label={t('Sort by {{field}}', { field: props.label })}
      onClick={() => props.onSort(props.sortKey)}
    >
      {props.label}
      <Icon className='size-3' aria-hidden='true' />
    </button>
  )
}

function ModelMetricsSkeleton() {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-2 border-b px-4 py-3 sm:px-5'>
        <Skeleton className='size-6 rounded-md' />
        <Skeleton className='h-4 w-36' />
      </div>
      <div className='space-y-3 p-4'>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className='flex items-center gap-4'>
            <Skeleton className='h-4 flex-1' />
            <Skeleton className='h-4 w-16' />
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-4 w-20' />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ModelMetricsTable(props: {
  data: QuotaDataItem[]
  filters?: DashboardFilters
  loading?: boolean
}) {
  const { t } = useTranslation()
  const [sortKey, setSortKey] = useState<SortKey>('totalTokens')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const durationMinutes = useMemo(
    () => getDashboardDurationMinutes(props.filters),
    [props.filters]
  )
  const metrics = useMemo(
    () => buildModelMetrics(props.data, durationMinutes),
    [durationMinutes, props.data]
  )
  const sortedMetrics = useMemo(
    () =>
      [...metrics].sort((left, right) => {
        const result = compareMetric(left, right, sortKey)
        return sortDirection === 'asc' ? result : -result
      }),
    [metrics, sortDirection, sortKey]
  )

  if (props.loading) {
    return <ModelMetricsSkeleton />
  }

  const handleSort = (nextSortKey: SortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextSortKey)
    setSortDirection(nextSortKey === 'modelName' ? 'asc' : 'desc')
  }

  return (
    <section className='overflow-hidden rounded-lg border'>
      <div className='flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5'>
        <div className='flex size-7 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400'>
          <Gauge className='size-4' aria-hidden='true' />
        </div>
        <div>
          <h2 className='text-sm font-semibold'>{t('Model metrics')}</h2>
        </div>
      </div>
      <div className='max-h-[28rem] overflow-auto'>
        <StaticDataTable
          className='rounded-none border-0'
          tableClassName='min-w-[760px] text-sm [&_tbody>tr]:h-10'
          headerRowClassName={cn(
            tableStyles.mutedHeaderRow,
            'sticky top-0 z-10 bg-background'
          )}
          data={sortedMetrics}
          getRowKey={(metric) => metric.modelName || 'unknown'}
          emptyContent={t('No model usage data available')}
          columns={[
            {
              id: 'model',
              header: (
                <SortableHeader
                  label={t(SORT_KEYS.modelName)}
                  sortKey='modelName'
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              ),
              className: tableStyles.compactHeaderCell,
              cellClassName: 'py-1.5',
              cell: (metric) => (
                <span className='font-mono text-sm'>
                  {metric.modelName || t('Unknown model')}
                </span>
              ),
            },
            {
              id: 'requests',
              header: (
                <SortableHeader
                  label={t(SORT_KEYS.requestCount)}
                  sortKey='requestCount'
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align='right'
                />
              ),
              className: tableStyles.compactHeaderCellRight,
              cellClassName: 'py-1.5 text-right font-mono',
              cell: (metric) => formatCompactNumber(metric.requestCount),
            },
            {
              id: 'tokens',
              header: (
                <SortableHeader
                  label={t(SORT_KEYS.totalTokens)}
                  sortKey='totalTokens'
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align='right'
                />
              ),
              className: tableStyles.compactHeaderCellRight,
              cellClassName: 'py-1.5 text-right font-mono',
              cell: (metric) => formatCompactNumber(metric.totalTokens),
            },
            {
              id: 'average-rpm',
              header: (
                <SortableHeader
                  label={t(SORT_KEYS.averageRpm)}
                  sortKey='averageRpm'
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align='right'
                />
              ),
              className: tableStyles.compactHeaderCellRight,
              cellClassName: 'py-1.5 text-right font-mono',
              cell: (metric) => formatNumber(metric.averageRpm),
            },
            {
              id: 'average-tpm',
              header: (
                <SortableHeader
                  label={t(SORT_KEYS.averageTpm)}
                  sortKey='averageTpm'
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align='right'
                />
              ),
              className: tableStyles.compactHeaderCellRight,
              cellClassName: 'py-1.5 text-right font-mono',
              cell: (metric) => formatCompactNumber(metric.averageTpm),
            },
          ]}
        />
      </div>
    </section>
  )
}
