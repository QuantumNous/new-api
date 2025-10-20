import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getCoreRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useDebounce } from '@/hooks'
import { Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/data-table/pagination'
import { DataTableViewOptions } from '@/components/data-table/view-options'
import { getChannels, searchChannels } from '../api'
import { DEFAULT_PAGE_SIZE } from '../constants'
import { channelsQueryKeys } from '../lib'
import { getChannelsColumns } from './channels-columns'
import { ChannelsFilterBar } from './channels-filter-bar'
import { DataTableBulkActions } from './data-table-bulk-actions'

export function ChannelsTable() {
  // Filter state
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  // Debounce keyword for search
  const debouncedKeyword = useDebounce(keyword, 500)

  // Determine whether to use search or regular list API
  const shouldSearch = Boolean(debouncedKeyword.trim())

  // Fetch channels data
  const { data, isLoading } = useQuery({
    queryKey: channelsQueryKeys.list({
      keyword: debouncedKeyword,
      status: status !== 'all' ? status : undefined,
      type: type !== 'all' ? Number(type) : undefined,
      p: pagination.pageIndex + 1,
      page_size: pagination.pageSize,
    }),
    queryFn: async () => {
      if (shouldSearch) {
        return searchChannels({
          keyword: debouncedKeyword,
          status: status !== 'all' ? status : undefined,
          type: type !== 'all' ? Number(type) : undefined,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      } else {
        return getChannels({
          status: status !== 'all' ? status : undefined,
          type: type !== 'all' ? Number(type) : undefined,
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      }
    },
  })

  const channels = data?.data?.items || []
  const totalCount = data?.data?.total || 0

  // Columns configuration
  const columns = getChannelsColumns()

  // React Table instance
  const table = useReactTable({
    data: channels,
    columns,
    pageCount: Math.ceil(totalCount / pagination.pageSize),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  // Reset filters
  const handleResetFilters = () => {
    setKeyword('')
    setStatus('all')
    setType('all')
  }

  return (
    <div className='space-y-4'>
      {/* Filter Bar */}
      <ChannelsFilterBar
        keyword={keyword}
        onKeywordChange={setKeyword}
        status={status}
        onStatusChange={setStatus}
        type={type}
        onTypeChange={setType}
        onReset={handleResetFilters}
      />

      {/* Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
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
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  <div className='flex items-center justify-center gap-2'>
                    <Loader2 className='h-5 w-5 animate-spin' />
                    <span className='text-muted-foreground'>
                      Loading channels...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
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
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  <span className='text-muted-foreground'>
                    No channels found.
                  </span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination & View Options */}
      <div className='flex items-center justify-between'>
        <DataTableViewOptions table={table} />
        <DataTablePagination table={table} />
      </div>

      {/* Bulk Actions Floating Toolbar */}
      <DataTableBulkActions table={table} />
    </div>
  )
}

// Helper to render cell content
function flexRender(content: any, context: any) {
  if (typeof content === 'function') {
    return content(context)
  }
  return content
}
