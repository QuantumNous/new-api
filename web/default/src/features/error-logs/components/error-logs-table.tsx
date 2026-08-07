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
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { DataTablePage } from '@/components/data-table'
import { getErrorLogs } from '../api'
import { DEFAULT_ERROR_LOGS_DATA } from '../constants'
import { buildApiParams } from '../lib/utils'
import { useErrorLogsColumns } from './error-logs-columns'
import { ErrorLogsFilterBar } from './error-logs-filter-bar'

const route = getRouteApi('/_authenticated/error-logs/')

export function ErrorLogsTable() {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const searchParams = route.useSearch()
  const columns = useErrorLogsColumns()

  const {
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 20 : 50 },
    globalFilter: { enabled: false },
    columnFilters: [],
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'error-logs',
      pagination.pageIndex + 1,
      pagination.pageSize,
      searchParams,
    ],
    queryFn: async () => {
      const result = await getErrorLogs(
        buildApiParams({
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          searchParams,
        })
      )

      if (!result?.success) {
        toast.error(result?.message || t('Failed to load error logs'))
        return DEFAULT_ERROR_LOGS_DATA
      }

      return result.data || DEFAULT_ERROR_LOGS_DATA
    },
    placeholderData: (previousData) => previousData,
  })

  const logs = data?.items || []
  const isLoadingData = isLoading || (isFetching && !data)

  const table = useReactTable({
    data: logs,
    columns,
    state: {
      pagination,
    },
    enableRowSelection: false,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount: Math.ceil((data?.total || 0) / pagination.pageSize),
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [pageCount, ensurePageInRange])

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoadingData}
      isFetching={isFetching}
      emptyTitle={t('No Error Logs Found')}
      emptyDescription={t(
        'No error logs available. Failed API requests will appear here when error logging is enabled.'
      )}
      skeletonKeyPrefix='error-log-skeleton'
      tableClassName='max-h-[calc(100dvh-13rem)] overflow-auto sm:max-h-[calc(100dvh-14rem)]'
      tableHeaderClassName='bg-muted/30 sticky top-0 z-10'
      toolbar={<ErrorLogsFilterBar table={table} />}
    />
  )
}
