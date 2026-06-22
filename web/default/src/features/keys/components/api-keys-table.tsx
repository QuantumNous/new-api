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
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Database } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'
import { DataTablePage } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { getApiKeys, searchApiKeys } from '../api'
import {
  API_KEY_STATUS,
  API_KEY_STATUS_OPTIONS,
  API_KEY_STATUSES,
  ERROR_MESSAGES,
} from '../constants'
import {
  keysActionsStickyCellClassName,
  keysTableActionsHeaderClassName,
  keysDisabledRowDesktopClassName,
  keysDisabledRowMobileClassName,
  keysFilterToolbarClassName,
  keysMobileShellClassName,
  keysTableClassName,
  keysTableHeaderClassName,
  keysTableMetaClass,
  keysTablePrimaryClass,
  keysTableRowBaseClassName,
} from '../lib/keys-ui-styles'
import { KeysQuotaCell } from './api-keys-cells'
import { type ApiKey } from '../types'
import { ApiKeyCell } from './api-keys-cells'
import { useApiKeysColumns } from './api-keys-columns'
import { useApiKeys } from './api-keys-provider'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { DataTableRowActions } from './data-table-row-actions'

const route = getRouteApi('/_authenticated/keys/')

function isDisabledApiKeyRow(apiKey: ApiKey) {
  return apiKey.status !== API_KEY_STATUS.ENABLED
}

function ApiKeysMobileSkeleton() {
  return (
    <div className='divide-border overflow-hidden rounded-lg border'>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className='space-y-2 border-b px-3 py-2.5 last:border-b-0'
        >
          <div className='flex items-center justify-between'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-5 w-16 rounded-md' />
          </div>
          <div className='flex items-center justify-between gap-3'>
            <Skeleton className='h-7 w-44' />
            <Skeleton className='h-8 w-16' />
          </div>
          <Skeleton className='h-3 w-28' />
        </div>
      ))}
    </div>
  )
}

function ApiKeysMobileList({
  table,
  isLoading,
}: {
  table: ReturnType<typeof useReactTable<ApiKey>>
  isLoading: boolean
}) {
  const { t } = useTranslation()
  const rows = table.getRowModel().rows

  if (isLoading) return <ApiKeysMobileSkeleton />

  if (!rows.length) {
    return (
      <div className={cn(keysMobileShellClassName, 'p-8')}>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon' className='text-slate-300'>
              <Database className='size-6' />
            </EmptyMedia>
            <EmptyTitle className='text-slate-100'>
              {t('keys.empty.title')}
            </EmptyTitle>
            <EmptyDescription className='text-slate-400'>
              {t('keys.empty.description')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className={cn(keysMobileShellClassName, 'divide-[#DBEAFE]')}>
      {rows.map((row) => {
        const apiKey = row.original
        const statusConfig = API_KEY_STATUSES[apiKey.status]

        return (
          <div
            key={row.id}
            className={cn(
              'space-y-2.5 border-b border-[#DBEAFE] bg-white px-3 py-2.5 last:border-b-0',
              isDisabledApiKeyRow(apiKey) && keysDisabledRowMobileClassName
            )}
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div
                  className={cn(
                    'truncate text-sm font-semibold',
                    keysTablePrimaryClass
                  )}
                >
                  {apiKey.name}
                </div>
                <div className='text-[11px] text-slate-400'>
                  {t('keys.col.access_key')}
                </div>
              </div>
              {statusConfig && (
                <StatusBadge
                  label={t(statusConfig.label)}
                  variant={statusConfig.variant}
                  showDot={statusConfig.showDot}
                  copyable={false}
                />
              )}
            </div>

            <div className='flex min-w-0 items-center justify-between gap-2'>
              <div className='min-w-0 flex-1 [&_button:first-child]:max-w-full [&_button:first-child]:truncate [&_button:first-child]:px-0'>
                <ApiKeyCell apiKey={apiKey} />
              </div>
              <DataTableRowActions row={row} />
            </div>

            <div className='text-xs'>
              <div className={cn('mb-1', keysTableMetaClass)}>
                {t('keys.col.quota')}
              </div>
              <KeysQuotaCell apiKey={apiKey} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ApiKeysTable() {
  const { t } = useTranslation()
  const { refreshTrigger } = useApiKeys()
  const columns = useApiKeysColumns()
  const [rowSelection, setRowSelection] = useState({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

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
    pagination: { defaultPage: 1, defaultPageSize: 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })

  // Fetch data with React Query
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'keys',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      // If there's a global filter, use search
      const hasFilter = globalFilter?.trim()

      if (hasFilter) {
        const result = await searchApiKeys({ keyword: globalFilter })
        if (!result.success) {
          if (result.message) {
            // eslint-disable-next-line no-console
            console.warn('[keys]', result.message)
          }
          toast.error(t(ERROR_MESSAGES.SEARCH_FAILED))
          return { items: [], total: 0 }
        }
        return {
          items: result.data || [],
          total: result.data?.length || 0,
        }
      }

      // Otherwise use pagination
      const result = await getApiKeys({
        p: pagination.pageIndex + 1,
        size: pagination.pageSize,
      })

      if (!result.success) {
        if (result.message) {
          // eslint-disable-next-line no-console
          console.warn('[keys]', result.message)
        }
        toast.error(t(ERROR_MESSAGES.LOAD_FAILED))
        return { items: [], total: 0 }
      }

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const apiKeys = data?.items || []

  const table = useReactTable({
    data: apiKeys,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: (row, _columnId, filterValue) => {
      const name = String(row.getValue('name')).toLowerCase()
      const key = String(row.original.key).toLowerCase()
      const searchValue = String(filterValue).toLowerCase()

      return name.includes(searchValue) || key.includes(searchValue)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: !globalFilter,
    pageCount: globalFilter
      ? Math.ceil((data?.total || 0) / pagination.pageSize)
      : Math.ceil((data?.total || 0) / pagination.pageSize),
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [pageCount, ensurePageInRange])

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('keys.empty.title')}
      emptyDescription={t('keys.empty.description')}
      skeletonKeyPrefix='api-keys-skeleton'
      toolbarProps={{
        searchPlaceholder: t('keys.filter.placeholder'),
        className: keysFilterToolbarClassName,
        filters: [
          {
            columnId: 'status',
            title: t('keys.filter.status'),
            options: API_KEY_STATUS_OPTIONS,
            singleSelect: true,
          },
        ],
      }}
      applyHeaderSize
      tableHeaderClassName={cn(
        keysTableHeaderClassName,
        keysTableActionsHeaderClassName
      )}
      tableClassName={keysTableClassName}
      mobile={<ApiKeysMobileList table={table} isLoading={isLoading} />}
      renderRow={(row) => {
        const apiKey = row.original
        const isDisabled = isDisabledApiKeyRow(apiKey)
        return (
          <TableRow
            key={row.id}
            data-state={row.getIsSelected() ? 'selected' : undefined}
            className={cn(
              keysTableRowBaseClassName,
              isDisabled && keysDisabledRowDesktopClassName
            )}
          >
            {row.getVisibleCells().map((cell) => {
              const colDef = cell.column.columnDef
              const isActions = cell.column.id === 'actions'
              return (
                <TableCell
                  key={cell.id}
                  style={{
                    width: cell.column.getSize(),
                    minWidth: colDef.minSize,
                    maxWidth: colDef.maxSize,
                  }}
                  className={cn(
                    'align-middle',
                    isActions && keysActionsStickyCellClassName
                  )}
                >
                  {flexRender(colDef.cell, cell.getContext())}
                </TableCell>
              )
            })}
          </TableRow>
        )
      }}
      bulkActions={<DataTableBulkActions table={table} />}
    />
  )
}
