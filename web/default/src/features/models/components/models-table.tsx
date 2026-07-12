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
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { getModels, searchModels, getVendors } from '../api'
import {
  DEFAULT_PAGE_SIZE,
  getModelStatusOptions,
} from '../constants'
import { modelsQueryKeys, vendorsQueryKeys } from '../lib'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { useModelsColumns } from './models-columns'
import { useModels } from './models-provider'

// shadcn/ui components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Data table sub-components
import {
  TableEmpty,
  TableSkeleton,
  MobileCardList,
} from '@/components/data-table'

// Icons
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Layers01Icon,
  CheckmarkCircle01Icon,
  CancelCircleIcon,
  Building01Icon,
  Search01Icon,
  FilterResetIcon,
  Download01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'

// Utilities
import { cn, getPageNumbers } from '@/lib/utils'

const route = getRouteApi('/_authenticated/models/$section')

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
    persistKey: 'models-filters',
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

  // Stat cards
  const enabledCount = models.filter((m) => m.status === 1).length
  const disabledCount = models.filter((m) => m.status !== 1).length
  const vendorCount = vendors.length

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

  // Reset filters
  const handleReset = () => {
    table.resetColumnFilters()
    table.setGlobalFilter('')
  }

  // Filter handlers
  const handleVendorFilterChange = (value: string | null) => {
    const column = table.getColumn('vendor_id')
    if (!column) return
    if (!value || value === 'all') {
      column.setFilterValue([])
    } else {
      column.setFilterValue([value])
    }
  }

  const handleStatusFilterChange = (value: string | null) => {
    const column = table.getColumn('status')
    if (!column) return
    if (!value || value === 'all') {
      column.setFilterValue([])
    } else {
      column.setFilterValue([value])
    }
  }

  const currentVendorValue =
    vendorFilter.length > 0 && !vendorFilter.includes('all')
      ? vendorFilter[0]
      : 'all'
  const currentStatusValue =
    statusFilter.length > 0 && !statusFilter.includes('all')
      ? statusFilter[0]
      : 'all'

  // Pagination
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()
  const pageNumbers = getPageNumbers(currentPage, totalPages)
  const startRow = totalCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const endRow = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    totalCount
  )

  // Rows
  const rows = table.getRowModel().rows

  return (
    <div className='space-y-6'>
      {/* Stat Cards */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {/* Total Models */}
        <div className='rounded-lg border border-border bg-card p-5'>
          <div className='mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary/[0.08] text-primary'>
            <HugeiconsIcon
              icon={Layers01Icon}
              strokeWidth={2}
              className='size-[18px]'
            />
          </div>
          <div className='text-sm text-muted-foreground'>{t('Total Models')}</div>
          <div className='font-mono text-2xl font-semibold tracking-tight text-foreground'>
            {totalCount}
          </div>
        </div>

        {/* Enabled */}
        <div className='rounded-lg border border-border bg-card p-5'>
          <div className='mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-success/[0.08] text-success'>
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              strokeWidth={2}
              className='size-[18px]'
            />
          </div>
          <div className='text-sm text-muted-foreground'>{t('Enabled')}</div>
          <div className='font-mono text-2xl font-semibold tracking-tight text-foreground'>
            {enabledCount}
          </div>
          {totalCount > 0 && (
            <div className='mt-1 text-[11px] text-muted-foreground'>
              {((enabledCount / totalCount) * 100).toFixed(1)}% {t('available')}
            </div>
          )}
        </div>

        {/* Disabled */}
        <div className='rounded-lg border border-border bg-card p-5'>
          <div className='mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-destructive/[0.08] text-destructive'>
            <HugeiconsIcon
              icon={CancelCircleIcon}
              strokeWidth={2}
              className='size-[18px]'
            />
          </div>
          <div className='text-sm text-muted-foreground'>{t('Disabled')}</div>
          <div className='font-mono text-2xl font-semibold tracking-tight text-foreground'>
            {disabledCount}
          </div>
        </div>

        {/* Vendors */}
        <div className='rounded-lg border border-border bg-card p-5'>
          <div className='mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary/[0.08] text-primary'>
            <HugeiconsIcon
              icon={Building01Icon}
              strokeWidth={2}
              className='size-[18px]'
            />
          </div>
          <div className='text-sm text-muted-foreground'>{t('Vendors')}</div>
          <div className='font-mono text-2xl font-semibold tracking-tight text-foreground'>
            {vendorCount}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative'>
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className='pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground'
          />
          <Input
            placeholder={t('Search model ID, display name...')}
            value={globalFilter ?? ''}
            onChange={(event) =>
              table.setGlobalFilter(event.target.value)
            }
            className='h-8 w-full pl-8 text-xs sm:w-[240px] lg:w-[280px]'
          />
        </div>

        <Select
          value={currentVendorValue}
          onValueChange={handleVendorFilterChange}
        >
          <SelectTrigger className='h-8 w-[130px] text-xs'>
            <SelectValue>
              {(value: string) => {
                if (value === 'all') return t('All Vendors')
                const opt = vendorOptions.find((o) => o.value === value)
                return opt ? opt.label : value
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>
              {`${t('All Vendors')}${vendorCounts?.all ? ` (${vendorCounts.all})` : ''}`}
            </SelectItem>
            {vendorOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {`${option.label}${vendorCounts?.[option.value] ? ` (${vendorCounts[option.value]})` : ''}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentStatusValue}
          onValueChange={handleStatusFilterChange}
        >
          <SelectTrigger className='h-8 w-[120px] text-xs'>
            <SelectValue>
              {(value: string) => {
                if (!value || value === 'all') return t('All Status')
                const opt = getModelStatusOptions(t).find(
                  (o) => o.value === value
                )
                return opt ? opt.label : value
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {[...getModelStatusOptions(t)].map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant='ghost'
          size='sm'
          onClick={handleReset}
          className='h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground'
        >
          <HugeiconsIcon
            icon={FilterResetIcon}
            strokeWidth={2}
            className='size-3'
          />
          {t('Reset')}
        </Button>
      </div>

      {/* Table Wrap */}
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border bg-card transition-opacity duration-150',
          isFetching && !isLoading && 'pointer-events-none opacity-60'
        )}
      >
        {/* Toolbar */}
        <div className='flex items-center justify-between border-b border-border px-4 py-3'>
          <span className='text-sm text-muted-foreground'>
            {t('Total {{count}} models', { count: totalCount })}
          </span>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground'
          >
            <HugeiconsIcon
              icon={Download01Icon}
              strokeWidth={2}
              className='size-3'
            />
            {t('Export')}
          </Button>
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
                    keyPrefix='model-skeleton'
                  />
                ) : rows.length === 0 ? (
                  <TableEmpty
                    colSpan={columns.length}
                    title={t('No Models Found')}
                    description={t(
                      'No models available. Create your first model to get started.'
                    )}
                  />
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={
                        row.getIsSelected() ? 'selected' : undefined
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

        {/* Mobile Card List */}
        {isMobile && (
          <MobileCardList
            table={table}
            isLoading={isLoading}
            emptyTitle={t('No Models Found')}
            emptyDescription={t(
              'No models available. Create your first model to get started.'
            )}
          />
        )}

        {/* Footer */}
        <div className='flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground'>
          <span>
            {t('Showing {{start}} to {{end}} of {{total}}', {
              start: startRow,
              end: endRow,
              total: totalCount,
            })}
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
                <div key={`${pageNumber}-${index}`} className='flex items-center'>
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
