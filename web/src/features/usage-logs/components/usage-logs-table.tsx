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
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination, DataTableToolbar } from '@/components/data-table'
import {
  getAllLogs,
  getUserLogs,
  getAllMidjourneyLogs,
  getUserMidjourneyLogs,
  getAllTaskLogs,
  getUserTaskLogs,
} from '../api'
import { LOG_TYPE_FILTERS } from '../constants'
import { buildApiParams, buildBaseParams } from '../lib/utils'
import { getCommonLogsColumns } from './columns/common-logs-columns'
import { getDrawingLogsColumns } from './columns/drawing-logs-columns'
import { getTaskLogsColumns } from './columns/task-logs-columns'
import { useUsageLogsContext } from './usage-logs-provider'
import { UsageLogsTabs } from './usage-logs-tabs'

const route = getRouteApi('/_authenticated/usage-logs/')

export function UsageLogsTable() {
  const { user } = useAuthStore((state) => state.auth)
  const isAdmin = user?.role === 100
  const { refreshTrigger, logCategory, setLogCategory } = useUsageLogsContext()
  const navigate = route.useNavigate()
  const searchParams = route.useSearch()

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
    columnFilters: [
      { columnId: 'type', searchKey: 'type', type: 'array' as const },
      { columnId: 'model_name', searchKey: 'model', type: 'string' as const },
      { columnId: 'token_name', searchKey: 'token', type: 'string' as const },
      { columnId: 'group', searchKey: 'group', type: 'string' as const },
      ...(isAdmin
        ? [
            {
              columnId: 'channel',
              searchKey: 'channel',
              type: 'string' as const,
            },
            {
              columnId: 'username',
              searchKey: 'username',
              type: 'string' as const,
            },
          ]
        : []),
    ],
  })

  // Fetch data with React Query
  const { data, isLoading } = useQuery({
    queryKey: [
      'logs',
      logCategory,
      isAdmin,
      pagination.pageIndex + 1,
      pagination.pageSize,
      columnFilters,
      globalFilter,
      searchParams,
      refreshTrigger,
    ],
    queryFn: async () => {
      let result

      switch (logCategory) {
        case 'common': {
          const params = buildApiParams({
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
            searchParams,
            columnFilters,
            isAdmin,
          })

          result = isAdmin
            ? await getAllLogs(params)
            : await getUserLogs(params)
          break
        }
        case 'drawing': {
          const baseParams = buildBaseParams({
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
            searchParams,
          })

          result = isAdmin
            ? await getAllMidjourneyLogs({
                ...baseParams,
                mj_id: searchParams.filter,
              })
            : await getUserMidjourneyLogs({
                ...baseParams,
                mj_id: searchParams.filter,
              })
          break
        }
        case 'task': {
          const baseParams = buildBaseParams({
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
            searchParams,
          })

          result = isAdmin
            ? await getAllTaskLogs({
                ...baseParams,
                task_id: searchParams.filter,
              })
            : await getUserTaskLogs({
                ...baseParams,
                task_id: searchParams.filter,
              })
          break
        }
      }

      if (!result?.success) {
        toast.error(result?.message || 'Failed to load logs')
        return { items: [], total: 0 }
      }

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const logs = data?.items || []

  // Use different column definitions based on log category
  const columns =
    logCategory === 'common'
      ? getCommonLogsColumns(isAdmin)
      : logCategory === 'drawing'
        ? getDrawingLogsColumns(isAdmin)
        : getTaskLogsColumns(isAdmin)

  const table = useReactTable({
    data: logs as any, // Different log types have different schemas
    columns: columns as any,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      globalFilter,
      pagination,
    },
    enableRowSelection: false,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount: Math.ceil((data?.total || 0) / pagination.pageSize),
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [pageCount, ensurePageInRange])

  // Handle tab change with URL update
  const handleTabChange = (category: typeof logCategory) => {
    setLogCategory(category)
    navigate({
      search: {
        ...searchParams,
        tab: category,
      },
    })
  }

  // Different filters for different log categories
  const filters =
    logCategory === 'common'
      ? [
          {
            columnId: 'type',
            title: 'Log Type',
            options: LOG_TYPE_FILTERS,
          },
        ]
      : []

  return (
    <div className='space-y-4 max-sm:has-[div[role="toolbar"]]:mb-16'>
      <DataTableToolbar
        table={table}
        customSearch={
          <UsageLogsTabs value={logCategory} onValueChange={handleTabChange} />
        }
        filters={filters}
      />
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
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
                  No logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}
