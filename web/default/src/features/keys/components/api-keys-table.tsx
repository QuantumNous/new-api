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
  flexRender,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useDebounce, useMediaQuery } from '@/hooks'
import { Database } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/sonner'
import { formatQuota } from '@/lib/format'
import { cn, getPageNumbers } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DISABLED_ROW_DESKTOP,
  DISABLED_ROW_MOBILE,
  TableEmpty,
  TableSkeleton,
} from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import { getApiKeys, searchApiKeys } from '../api'
import {
  API_KEY_STATUS,
  API_KEY_STATUS_OPTIONS,
  API_KEY_STATUSES,
  ERROR_MESSAGES,
} from '../constants'
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
      <div className='rounded-lg border p-8'>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Database className='size-6' />
            </EmptyMedia>
            <EmptyTitle>{t('No API Keys Found')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'No API keys available. Create your first API key to get started.'
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className='divide-border overflow-hidden rounded-lg border'>
      {rows.map((row) => {
        const apiKey = row.original
        const statusConfig = API_KEY_STATUSES[apiKey.status]
        const total = apiKey.used_quota + apiKey.remain_quota

        return (
          <div
            key={row.id}
            className={cn(
              'bg-card space-y-2.5 border-b px-3 py-2.5 last:border-b-0',
              isDisabledApiKeyRow(apiKey) && DISABLED_ROW_MOBILE
            )}
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='truncate text-sm font-semibold'>
                  {apiKey.name}
                </div>
                <div className='text-muted-foreground text-[11px]'>
                  {t('API Key')}
                </div>
              </div>
              {statusConfig && (
                <StatusBadge
                  label={t(statusConfig.label)}
                  variant={statusConfig.variant}
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

            <div className='flex items-center justify-between gap-2 text-xs'>
              <span className='text-muted-foreground'>{t('Quota')}</span>
              {apiKey.unlimited_quota ? (
                <span className='font-medium'>{t('Unlimited')}</span>
              ) : (
                <span className='font-medium tabular-nums'>
                  {formatQuota(apiKey.remain_quota)}
                  <span className='text-muted-foreground font-normal'>
                    {' / '}
                    {formatQuota(total)}
                  </span>
                </span>
              )}
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
  const isMobile = useMediaQuery('(max-width: 640px)')
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
    persistKey: 'keys-filters',
    pagination: { defaultPage: 1, defaultPageSize: 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: '_tokenSearch', searchKey: 'token', type: 'string' },
    ],
  })

  const tokenFilterFromUrl =
    (columnFilters.find((f) => f.id === '_tokenSearch')?.value as string) || ''
  const [tokenFilterInput, setTokenFilterInput] = useState(tokenFilterFromUrl)
  const debouncedTokenFilter = useDebounce(tokenFilterInput, 500)

  useEffect(() => {
    setTokenFilterInput(tokenFilterFromUrl)
  }, [tokenFilterFromUrl])

  useEffect(() => {
    if (debouncedTokenFilter !== tokenFilterFromUrl) {
      onColumnFiltersChange((prev) => {
        const filtered = prev.filter((f) => f.id !== '_tokenSearch')
        return debouncedTokenFilter
          ? [...filtered, { id: '_tokenSearch', value: debouncedTokenFilter }]
          : filtered
      })
    }
  }, [debouncedTokenFilter, tokenFilterFromUrl, onColumnFiltersChange])

  const tokenFilter = tokenFilterFromUrl
  const shouldSearch = Boolean(globalFilter?.trim() || tokenFilter.trim())

  // Fetch data with React Query
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'keys',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      tokenFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      const result = shouldSearch
        ? await searchApiKeys({
            keyword: globalFilter,
            token: tokenFilter,
            p: pagination.pageIndex + 1,
            size: pagination.pageSize,
          })
        : await getApiKeys({
            p: pagination.pageIndex + 1,
            size: pagination.pageSize,
          })

      if (!result.success) {
        toast.error(
          result.message ||
            t(
              shouldSearch
                ? ERROR_MESSAGES.SEARCH_FAILED
                : ERROR_MESSAGES.LOAD_FAILED
            )
        )
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
  const totalCount = data?.total || 0

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
    globalFilterFn: () => true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    pageCount: Math.ceil((data?.total || 0) / pagination.pageSize),
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [pageCount, ensurePageInRange])

  // Filter handlers
  const handleStatusFilterChange = (value: string) => {
    const column = table.getColumn('status')
    if (!column) return
    if (value === 'all') {
      column.setFilterValue([])
    } else {
      column.setFilterValue([value])
    }
  }

  const currentStatusValue =
    (columnFilters.find((f) => f.id === 'status')?.value as string[] || [])
      .filter((v) => v !== 'all')[0] || 'all'

  // Selected count
  const selectedCount = Object.keys(rowSelection).length

  // Pagination
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()
  const pageNumbers = getPageNumbers(currentPage, totalPages)
  const startRow =
    totalCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const endRow = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    totalCount
  )

  // Rows
  const rows = table.getRowModel().rows

  return (
    <div className='space-y-6'>
      {/* Table Wrap */}
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border bg-card transition-opacity duration-150',
          isFetching && !isLoading && 'pointer-events-none opacity-60'
        )}
      >
        {/* Toolbar */}
        <div className='flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <div className='relative'>
              <HugeiconsIcon
                icon={Search01Icon}
                strokeWidth={2}
                className='pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground'
              />
              <Input
                placeholder={t('Filter by name...')}
                value={globalFilter ?? ''}
                onChange={(event) => table.setGlobalFilter(event.target.value)}
                className='h-8 w-full pl-8 text-xs sm:w-[200px] lg:w-[240px]'
              />
            </div>

            <Input
              placeholder={t('Filter by API key...')}
              aria-label={t('Filter by API key...')}
              value={tokenFilterInput}
              onChange={(e) => setTokenFilterInput(e.target.value)}
              className='h-8 w-full text-xs sm:w-[180px] lg:w-[220px]'
            />

            <Select
              value={currentStatusValue}
              onValueChange={handleStatusFilterChange}
            >
            <SelectTrigger className='h-8 w-[130px] text-xs'>
              <SelectValue>
                {(value: string) => {
                  if (value === 'all') return t('All Status')
                  const opt = API_KEY_STATUS_OPTIONS.find(
                    (o) => o.value === value
                  )
                  return opt ? t(opt.label) : value
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('All Status')}</SelectItem>
                {[...API_KEY_STATUS_OPTIONS].map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className='text-[11px] text-muted-foreground'>
            {t('Selected {{count}} items', { count: selectedCount })}
          </span>
        </div>

        {/* Desktop Table */}
        {!isMobile && (
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader className='bg-muted/30'>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ width: header.getSize() }}
                    >
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
                <TableSkeleton
                  table={table}
                  keyPrefix='api-keys-skeleton'
                />
              ) : rows.length === 0 ? (
                <TableEmpty
                  colSpan={columns.length}
                  title={t('No API Keys Found')}
                  description={t(
                    'No API keys available. Create your first API key to get started.'
                  )}
                />
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={
                      row.getIsSelected() ? 'selected' : undefined
                    }
                    className={
                      isDisabledApiKeyRow(row.original)
                        ? DISABLED_ROW_DESKTOP
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

        {/* Mobile List */}
        {isMobile && (
          <ApiKeysMobileList table={table} isLoading={isLoading} />
        )}

        {/* Footer */}
        <div className='flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground'>
          <span>
            {t('Total {{count}} keys', { count: totalCount })}
          </span>

          {totalPages > 0 && (
            <div className='flex items-center gap-0.5'>
              <Button
                variant='ghost'
                className='h-6.5 w-6.5 p-0 text-xs'
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  strokeWidth={2}
                  className='size-3.5'
                />
              </Button>

              {pageNumbers.map((pageNumber, index) => (
                <div
                  key={`${pageNumber}-${index}`}
                  className='flex items-center'
                >
                  {pageNumber === '...' ? (
                    <span className='px-1 text-muted-foreground'>...</span>
                  ) : (
                    <Button
                      variant={
                        currentPage === pageNumber ? 'default' : 'ghost'
                      }
                      className='h-6.5 min-w-6.5 px-1.5 text-xs'
                      onClick={() =>
                        table.setPageIndex((pageNumber as number) - 1)
                      }
                    >
                      {pageNumber}
                    </Button>
                  )}
                </div>
              ))}

              <Button
                variant='ghost'
                className='h-6.5 w-6.5 p-0 text-xs'
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  className='size-3.5'
                />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {!isMobile && Object.keys(rowSelection).length > 0 && (
        <DataTableBulkActions table={table} />
      )}
    </div>
  )
}
