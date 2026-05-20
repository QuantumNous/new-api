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
import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { DataTablePage } from '@/components/data-table'
import { getModels, searchModels, getVendors } from '../api'
import {
  DEFAULT_PAGE_SIZE,
  getModelStatusOptions,
  getSyncStatusOptions,
} from '../constants'
import { modelsQueryKeys, vendorsQueryKeys } from '../lib'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { useModelsColumns } from './models-columns'
import { useModels } from './models-provider'

const route = getRouteApi('/_authenticated/models/$section')

const modelsToolbarClassName = cn(
  '[&_input]:border-white/15 [&_input]:bg-slate-950/50 [&_input]:text-slate-100',
  '[&_input::placeholder]:text-slate-500',
  '[&_button]:border-white/15 [&_button]:text-slate-200',
  '[&_button[data-state=open]]:bg-slate-800'
)

const modelsTableHeaderClassName = cn(
  'bg-slate-900/80 text-slate-200',
  '[&_th]:border-white/10 [&_th]:text-slate-200',
  '[&_button]:text-slate-200',
  '[&_svg]:text-slate-400',
  '[&_[data-slot=checkbox]]:border-white/25'
)

const modelsDisabledRowClassName = cn(
  '[&>td:first-child]:border-l-muted-foreground/35 [&>td:first-child]:border-l-4 [&>td:first-child]:pl-1',
  'bg-slate-900/50 hover:bg-slate-900/60'
)

const modelsSelectedRowClassName = cn(
  'data-[state=selected]:!bg-cyan-500/10',
  'data-[state=selected]:hover:!bg-cyan-500/15',
  'data-[state=selected]:!text-slate-100',
  'data-[state=selected]:ring-1 data-[state=selected]:ring-cyan-400/30',
  '[&[data-state=selected]_.text-muted-foreground]:!text-slate-300'
)

const modelsTableClassName = cn(
  'border-white/10 bg-slate-900/40',
  '[&_[data-slot=empty-title]]:text-slate-100',
  '[&_[data-slot=empty-description]]:text-slate-400',
  '[&_[data-slot=empty-icon]]:text-slate-300',
  '[&_[data-slot=table-row]:hover]:!bg-white/5',
  '[&_[data-slot=table-row][data-state=selected]]:!bg-cyan-500/10',
  '[&_[data-slot=table-row][data-state=selected]:hover]:!bg-cyan-500/15',
  '[&_[data-slot=table-row][data-state=selected]]:!text-slate-100',
  '[&_[data-slot=table-row][data-state=selected]_.text-muted-foreground]:!text-slate-300',
  '[&_[data-slot=table-row][data-state=selected]_[data-slot=checkbox]]:border-cyan-400/50',
  '[&_th:last-child]:sticky [&_th:last-child]:right-0 [&_th:last-child]:z-20',
  '[&_th:last-child]:border-l [&_th:last-child]:border-white/10',
  '[&_th:last-child]:bg-slate-900/95',
  '[&_th:last-child]:shadow-[-10px_0_16px_-10px_rgba(0,0,0,0.65)]',
  '[&_td:last-child]:sticky [&_td:last-child]:right-0 [&_td:last-child]:z-10',
  '[&_td:last-child]:border-l [&_td:last-child]:border-white/10',
  '[&_td:last-child]:bg-slate-900/95',
  '[&_td:last-child]:shadow-[-10px_0_16px_-10px_rgba(0,0,0,0.65)]',
  '[&_[data-slot=table-row][data-state=selected]_td:last-child]:!bg-slate-900',
  '[&_[data-slot=table-row]:hover_td:last-child]:bg-slate-900'
)

export function ModelsTable() {
  const { t } = useTranslation()
  const { selectedVendor } = useModels()
  const isMobile = useMediaQuery('(max-width: 640px)')

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    description: false,
    bound_channels: false,
    quota_types: false,
  })
  const [rowSelection, setRowSelection] = useState({})

  // URL state management
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
    pagination: {
      defaultPage: 1,
      defaultPageSize: isMobile ? 10 : DEFAULT_PAGE_SIZE,
    },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'vendor_id', searchKey: 'vendor', type: 'array' },
      { columnId: 'sync_official', searchKey: 'sync', type: 'array' },
    ],
  })

  // Extract filters from column filters
  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as string[]) || []
  const vendorFilter =
    (columnFilters.find((f) => f.id === 'vendor_id')?.value as string[]) || []
  const syncFilter =
    (columnFilters.find((f) => f.id === 'sync_official')?.value as string[]) ||
    []

  // Fetch vendors for filter
  const { data: vendorsData } = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: () => getVendors({ page_size: 1000 }),
  })

  const vendors = useMemo(
    () => vendorsData?.data?.items || [],
    [vendorsData?.data?.items]
  )

  const vendorOptions = useMemo(() => {
    return vendors.map((v) => ({
      label: v.name,
      value: String(v.id),
    }))
  }, [vendors])

  // Determine whether to use search or regular list API
  const shouldSearch = Boolean(globalFilter?.trim())

  // Apply selected vendor from context or filter
  const activeVendorFilter =
    selectedVendor ||
    (vendorFilter.length > 0 && !vendorFilter.includes('all')
      ? vendorFilter[0]
      : undefined)

  // Fetch models data
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data, isLoading, isFetching } = useQuery({
    queryKey: modelsQueryKeys.list({
      keyword: globalFilter,
      vendor: activeVendorFilter,
      status:
        statusFilter.length > 0 && !statusFilter.includes('all')
          ? statusFilter[0]
          : undefined,
      sync_official:
        syncFilter.length > 0 && !syncFilter.includes('all')
          ? syncFilter[0]
          : undefined,
      p: pagination.pageIndex + 1,
      page_size: pagination.pageSize,
    }),
    queryFn: async () => {
      if (shouldSearch || activeVendorFilter) {
        return searchModels({
          keyword: globalFilter,
          vendor: activeVendorFilter,
          status:
            statusFilter.length > 0 && !statusFilter.includes('all')
              ? statusFilter[0]
              : undefined,
          sync_official:
            syncFilter.length > 0 && !syncFilter.includes('all')
              ? syncFilter[0]
              : undefined,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      } else {
        return getModels({
          status:
            statusFilter.length > 0 && !statusFilter.includes('all')
              ? statusFilter[0]
              : undefined,
          sync_official:
            syncFilter.length > 0 && !syncFilter.includes('all')
              ? syncFilter[0]
              : undefined,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const models = data?.data?.items || []
  const totalCount = data?.data?.total || 0
  const vendorCounts = data?.data?.vendor_counts

  // Columns configuration
  const columns = useModelsColumns(vendors)

  // React Table instance
  const table = useReactTable({
    data: models,
    columns,
    pageCount: Math.ceil(totalCount / pagination.pageSize),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange,
    onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  // Ensure page is in range when total count changes
  const pageCount = table.getPageCount()
  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [pageCount, ensurePageInRange])

  // Prepare filter options
  const vendorFilterOptions = [
    {
      label: `${t('All Vendors')}${vendorCounts?.all ? ` (${vendorCounts.all})` : ''}`,
      value: 'all',
    },
    ...vendorOptions.map((option) => ({
      label: `${option.label}${vendorCounts?.[option.value] ? ` (${vendorCounts[option.value]})` : ''}`,
      value: option.value,
    })),
  ]

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No model resources found')}
      emptyDescription={t(
        'No models available. Create your first model to get started.'
      )}
      skeletonKeyPrefix='model-skeleton'
      applyHeaderSize
      tableHeaderClassName={modelsTableHeaderClassName}
      tableClassName={modelsTableClassName}
      toolbarProps={{
        searchPlaceholder: t('Filter by model resource name...'),
        className: modelsToolbarClassName,
        filters: [
          {
            columnId: 'status',
            title: t('Model status'),
            options: [...getModelStatusOptions(t)],
            singleSelect: true,
          },
          {
            columnId: 'vendor_id',
            title: t('Service source'),
            options: vendorFilterOptions,
            singleSelect: true,
          },
          {
            columnId: 'sync_official',
            title: t('Official Sync'),
            options: [...getSyncStatusOptions(t)],
            singleSelect: true,
          },
        ],
      }}
      getRowClassName={(row) => {
        const isSelected = row.getIsSelected()
        const isDisabled = row.original.status === 0

        if (isSelected) {
          return cn(
            modelsSelectedRowClassName,
            isDisabled &&
              '[&>td:first-child]:border-l-cyan-500/40 [&>td:first-child]:border-l-4'
          )
        }

        if (isDisabled) {
          return modelsDisabledRowClassName
        }

        return undefined
      }}
      bulkActions={<DataTableBulkActions table={table} />}
    />
  )
}
