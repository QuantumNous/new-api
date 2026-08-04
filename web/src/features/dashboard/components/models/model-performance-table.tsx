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
import { Link } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  DatabaseZap,
  RefreshCw,
  Settings2,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { IconBadge } from '@/components/ui/icon-badge'
import { getDefaultDays } from '@/features/dashboard/lib'
import type { DashboardFilters } from '@/features/dashboard/types'
import { getAdminModelPerformance } from '@/features/performance-metrics/api'
import {
  buildAdminPerformanceRows,
  getAdminPerformanceDisplayState,
} from '@/features/performance-metrics/lib/admin'
import { useMediaQuery } from '@/hooks'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { useModelPerformanceColumns } from './model-performance-columns'

const LIVE_RANGE_TOLERANCE_SECONDS = 5 * 60
const REFRESH_INTERVAL_MS = 60 * 1000
const COLUMN_VISIBILITY_STORAGE_KEY = 'dashboard-model-performance-columns:v1'

interface ModelPerformanceTableProps {
  filters: DashboardFilters
}

function resolveRequestRange(filters: DashboardFilters): {
  start: number
  end: number
  followsNow: boolean
  duration: number
} {
  const now = Math.floor(Date.now() / 1000)
  const defaultDuration = getDefaultDays(filters.time_granularity) * 24 * 3600
  const rawEnd = filters.end_timestamp
    ? Math.floor(filters.end_timestamp.getTime() / 1000)
    : now
  const rawStart = filters.start_timestamp
    ? Math.floor(filters.start_timestamp.getTime() / 1000)
    : rawEnd - defaultDuration
  const duration = Math.max(1, rawEnd - rawStart)
  return {
    start: rawStart,
    end: rawEnd,
    followsNow: Math.abs(now - rawEnd) <= LIVE_RANGE_TOLERANCE_SECONDS,
    duration,
  }
}

export function ModelPerformanceTable(props: ModelPerformanceTableProps) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const requestRange = resolveRequestRange(props.filters)
  const metricsQuery = useQuery({
    queryKey: [
      'admin-model-performance',
      requestRange.start,
      requestRange.end,
      requestRange.followsNow,
    ],
    queryFn: () => {
      if (!requestRange.followsNow) {
        return getAdminModelPerformance(requestRange.start, requestRange.end)
      }
      const end = Math.floor(Date.now() / 1000)
      return getAdminModelPerformance(end - requestRange.duration, end)
    },
    placeholderData: (previousData) => previousData,
    refetchInterval: REFRESH_INTERVAL_MS,
    retry: false,
  })
  const data = metricsQuery.data?.data
  const rows = useMemo(() => buildAdminPerformanceRows(data), [data])
  const columns = useModelPerformanceColumns()
  const initialColumnVisibility = useMemo(
    () => ({
      output_tokens: !isMobile,
      groups: !isMobile,
    }),
    [isMobile]
  )
  const { table } = useDataTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    withExpandedRowModel: true,
    initialSorting: [
      { id: 'health', desc: false },
      { id: 'request_count', desc: true },
    ],
    initialColumnVisibility,
    initialPagination: { pageIndex: 0, pageSize: 20 },
    columnVisibilityStorageKey: COLUMN_VISIBILITY_STORAGE_KEY,
  })
  const groupOptions = useMemo(() => {
    const groups = new Set<string>()
    for (const model of data?.models ?? []) {
      for (const group of model.groups) groups.add(group.group)
    }
    return [...groups]
      .sort((left, right) => left.localeCompare(right))
      .map((group) => ({ label: group, value: group }))
  }, [data?.models])
  const displayState = getAdminPerformanceDisplayState({
    loading: metricsQuery.isLoading,
    error: metricsQuery.isError,
    hasData: data != null,
    metricsEnabled: data?.metrics_enabled,
    hasCompleteBuckets: data?.has_complete_buckets,
    rowCount: rows.length,
  })

  if (displayState === 'error') {
    return (
      <Empty className='rounded-lg border'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <DatabaseZap />
          </EmptyMedia>
          <EmptyTitle>{t('Failed to load model performance')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'The performance query failed. Existing call analytics are unaffected.'
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => void metricsQuery.refetch()}>
            <RefreshCw data-icon='inline-start' />
            {t('Retry')}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const actualEnd = data?.actual_period.end
  const updatedThrough = actualEnd
    ? formatTimestampToDate(actualEnd)
    : t('Waiting for complete data')

  return (
    <section
      className='overflow-hidden rounded-lg border'
      aria-labelledby='model-performance-title'
    >
      <div className='flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5'>
        <div className='flex min-w-0 items-start gap-2.5'>
          <IconBadge tone='info' size='sm'>
            <Activity />
          </IconBadge>
          <div className='min-w-0'>
            <h3 id='model-performance-title' className='text-sm font-semibold'>
              {t('Model performance metrics')}
            </h3>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {t('Aggregated relay performance for all models.')}
            </p>
          </div>
        </div>
        <div className='text-muted-foreground text-right text-[11px] leading-5'>
          <div>{t('Updated through {{time}}', { time: updatedThrough })}</div>
          {data && (
            <div>
              {t('Expected aggregation delay: up to {{seconds}} seconds', {
                seconds: data.expected_max_lag_seconds,
              })}
            </div>
          )}
        </div>
      </div>

      <div className='space-y-3 p-3 sm:p-4'>
        {props.filters.username && (
          <Alert>
            <AlertTriangle />
            <AlertTitle>{t('Global model performance')}</AlertTitle>
            <AlertDescription>
              {t(
                'Call analytics are filtered by user; model performance remains global.'
              )}
            </AlertDescription>
          </Alert>
        )}

        {metricsQuery.isError && data && (
          <Alert variant='destructive'>
            <DatabaseZap />
            <AlertTitle>{t('Refresh failed')}</AlertTitle>
            <AlertDescription>
              {t('Showing the most recent successful performance data.')}
            </AlertDescription>
            <AlertAction>
              <Button
                variant='outline'
                size='sm'
                onClick={() => void metricsQuery.refetch()}
              >
                {t('Retry')}
              </Button>
            </AlertAction>
          </Alert>
        )}

        {displayState === 'disabled' && (
          <Alert>
            <Settings2 />
            <AlertTitle>{t('Metrics disabled')}</AlertTitle>
            <AlertDescription>
              {t('Model performance metrics are disabled.')}
            </AlertDescription>
            <AlertAction>
              <Button
                variant='outline'
                size='sm'
                render={
                  <Link
                    to='/system-settings/operations/$section'
                    params={{ section: 'alerts' }}
                  />
                }
                nativeButton={false}
              >
                {t('Open monitoring settings')}
              </Button>
            </AlertAction>
          </Alert>
        )}

        {displayState === 'no_complete_buckets' && (
          <Alert>
            <AlertTriangle />
            <AlertTitle>{t('No complete performance buckets')}</AlertTitle>
            <AlertDescription>
              {t(
                'The selected range does not contain a complete performance bucket.'
              )}
            </AlertDescription>
          </Alert>
        )}

        <DataTablePage
          table={table}
          columns={columns}
          isLoading={displayState === 'loading'}
          isFetching={metricsQuery.isFetching && !metricsQuery.isLoading}
          emptyTitle={t('No model performance data')}
          emptyDescription={t(
            'No enabled models or performance samples were found.'
          )}
          emptyIcon={<DatabaseZap />}
          skeletonKeyPrefix='model-performance-skeleton'
          applyHeaderSize
          fixedHeight={false}
          hideMobile
          paginationInFooter={false}
          pinnedColumns={[
            { columnId: 'model_name', side: 'left' },
            { columnId: 'health', side: 'left' },
          ]}
          getRowClassName={(row) =>
            row.original.kind === 'group' ? 'bg-muted/25' : undefined
          }
          getColumnClassName={(columnId) =>
            columnId === 'model_name' || columnId === 'health'
              ? undefined
              : 'text-right'
          }
          toolbarProps={{
            searchKey: 'model_name',
            searchPlaceholder: t('Filter by model name...'),
            searchDebounceMs: 200,
            filters: [
              {
                columnId: 'health',
                title: t('Health'),
                options: [
                  { label: 'Critical', value: 'critical' },
                  { label: 'Degraded', value: 'degraded' },
                  { label: 'Healthy', value: 'healthy' },
                  {
                    label: 'Insufficient samples',
                    value: 'insufficient_samples',
                  },
                  {
                    label: 'No performance samples',
                    value: 'no_samples',
                  },
                ],
              },
              {
                columnId: 'enabled',
                title: t('Status'),
                options: [
                  { label: 'Enabled', value: 'true' },
                  { label: 'Disabled', value: 'false' },
                ],
                singleSelect: true,
              },
              {
                columnId: 'groups',
                title: t('Groups'),
                options: groupOptions,
              },
            ],
            preActions: (
              <Button
                variant='outline'
                size='sm'
                onClick={() => void metricsQuery.refetch()}
                disabled={metricsQuery.isFetching}
                aria-label={t('Refresh')}
              >
                <RefreshCw
                  data-icon='inline-start'
                  className={cn(metricsQuery.isFetching && 'animate-spin')}
                />
                {t('Refresh')}
              </Button>
            ),
          }}
        />
      </div>
    </section>
  )
}
