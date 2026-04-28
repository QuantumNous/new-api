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
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTablePagination,
  DataTableToolbar,
  TableSkeleton,
  TableEmpty,
  MobileCardList,
} from '@/components/data-table'
import { PageFooterPortal } from '@/components/layout'
import { getApiKeys, searchApiKeys } from '../api'
import { API_KEY_STATUS_OPTIONS, ERROR_MESSAGES } from '../constants'
import { type ApiKey } from '../types'
import { useApiKeysColumns } from './api-keys-columns'
import { ApiKeysPrimaryButtons } from './api-keys-primary-buttons'
import { useApiKeys } from './api-keys-provider'
import { DataTableBulkActions } from './data-table-bulk-actions'

const route = getRouteApi('/_authenticated/keys/')

export function ApiKeysTable() {
  const { t } = useTranslation()
  const { refreshTrigger } = useApiKeys()
  const columns = useApiKeysColumns()
  const isMobile = useMediaQuery('(max-width: 640px)')
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
          toast.error(result.message || t(ERROR_MESSAGES.SEARCH_FAILED))
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
    <>
      <div className='space-y-4'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
          <ApiKeysPrimaryButtons />
          <div className='min-w-0 sm:flex sm:justify-end'>
            <DataTableToolbar
              table={table}
              searchPlaceholder={t('Filter by name or key...')}
              filters={[
                {
                  columnId: 'status',
                  title: t('Status'),
                  options: API_KEY_STATUS_OPTIONS,
                },
              ]}
            />
          </div>
        </div>
        {isMobile ? (
          <MobileCardList
            table={table}
            isLoading={isLoading}
            emptyTitle={t('No API Keys Found')}
            emptyDescription={t(
              'No API keys available. Create your first API key to get started.'
            )}
          />
        ) : (
          <div
            className={cn(
              'overflow-hidden rounded-md border transition-opacity duration-150',
              isFetching && !isLoading && 'pointer-events-none opacity-50'
            )}
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton table={table} keyPrefix='api-keys-skeleton' />
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableEmpty
                    colSpan={columns.length}
                    title={t('No API Keys Found')}
                    description={t(
                      'No API keys available. Create your first API key to get started.'
                    )}
                  />
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      className={
                        (row.original as ApiKey).status !== 1
                          ? 'opacity-60'
                          : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {!isMobile && <DataTableBulkActions table={table} />}
      </div>
      <PageFooterPortal>
        <DataTablePagination table={table} />
      </PageFooterPortal>
    </>
  )
}
