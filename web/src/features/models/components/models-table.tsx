import { useEffect, useMemo, useState } from 'react'
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
import { toast } from 'sonner'
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
  TableSkeleton,
  TableEmpty,
} from '@/components/data-table'
import { getModels, getVendors } from '../api'
import { ERROR_MESSAGES } from '../constants'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { getModelsColumns } from './models-columns'
import { ModelsFilterBar } from './models-filter-bar'
import { useModels } from './models-provider'

const route = getRouteApi('/_authenticated/models/')

export function ModelsTable() {
  const { refreshTrigger, activeVendorKey } = useModels()
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
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [],
  })

  // Fetch vendors for vendor map
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const result = await getVendors({ page_size: 1000 })
      if (!result.success) {
        toast.error(result.message || ERROR_MESSAGES.VENDOR_LOAD_FAILED)
        return { items: [] }
      }
      return result.data || { items: [] }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const vendors = vendorsData?.items || []
  const vendorMap = useMemo(() => {
    const map: Record<number, (typeof vendors)[0]> = {}
    vendors.forEach((v) => {
      map[v.id] = v
    })
    return map
  }, [vendors])

  // Fetch models data with React Query
  const { data, isLoading } = useQuery({
    queryKey: [
      'models',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      activeVendorKey,
      refreshTrigger,
    ],
    queryFn: async () => {
      const result = await getModels({
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        vendor: activeVendorKey !== 'all' ? activeVendorKey : undefined,
      })

      if (!result.success) {
        toast.error(result.message || ERROR_MESSAGES.LOAD_FAILED)
        return { items: [], total: 0 }
      }

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const models = data?.items || []

  const columns = useMemo(() => getModelsColumns(vendorMap), [vendorMap])

  const table = useReactTable({
    data: models,
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
      const modelName = String(row.getValue('model_name')).toLowerCase()
      const description = String(row.original.description || '').toLowerCase()
      const searchValue = String(filterValue).toLowerCase()

      return (
        modelName.includes(searchValue) || description.includes(searchValue)
      )
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
    <div className='space-y-4 max-sm:has-[div[role="toolbar"]]:mb-16'>
      <ModelsFilterBar table={table} />
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton table={table} keyPrefix='model-skeleton' />
            ) : table.getRowModel().rows.length === 0 ? (
              <TableEmpty
                colSpan={columns.length}
                title='No Models Found'
                description='No models available. Try adjusting your search or filters.'
              />
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={
                    row.original.status === 0 ? 'bg-muted/50' : undefined
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
      <DataTablePagination table={table} />
      <DataTableBulkActions table={table} />
    </div>
  )
}
