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
import { getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'

import { getMarketModels } from '../api'
import { ERROR_MESSAGES, getMarketModelStatusOptions } from '../constants'
import { useMarketModelsColumns } from './market-models-columns'
import { useMarketModels } from './market-models-provider'

const route = getRouteApi('/_authenticated/market-models/')

export function MarketModelsTable() {
  const { t } = useTranslation()
  const columns = useMarketModelsColumns()
  const { refreshTrigger } = useMarketModels()
  const isMobile = useMediaQuery('(max-width: 640px)')

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })

  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const statusFilterValue = statusFilter[0] ?? ''

  // Fetch data with React Query
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'market-models',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilterValue,
      refreshTrigger,
    ],
    queryFn: async () => {
      const result = await getMarketModels({
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        status: statusFilterValue,
      })

      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_FAILED))
        return { items: [], total: 0 }
      }

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const marketModels = data?.items || []

  const { table } = useDataTable({
    data: marketModels,
    columns,
    enableRowSelection: false,
    columnFilters,
    globalFilter,
    pagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const model = String(row.getValue('model')).toLowerCase()
      const provider = String(row.getValue('provider')).toLowerCase()
      const searchValue = String(filterValue).toLowerCase()

      return (
        model.includes(searchValue) || provider.includes(searchValue)
      )
    },
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total || 0,
    ensurePageInRange,
  })

  const statusOptions = useMemo(() => getMarketModelStatusOptions(t), [t])

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Model Market Items Found')}
      emptyDescription={t(
        'No model market items available. Create your first item to get started.'
      )}
      skeletonKeyPrefix='market-models-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by model or provider...'),
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: statusOptions,
            singleSelect: true,
          },
        ],
      }}
    />
  )
}
