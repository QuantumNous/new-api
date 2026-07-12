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
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/sonner'
import { cn, getPageNumbers } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  MobileCardList,
} from '@/components/data-table'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  FilterResetIcon,
  Download01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import { getUsers, searchUsers } from '../api'
import {
  USER_STATUS,
  getUserStatusOptions,
  getUserRoleOptions,
  isUserDeleted,
} from '../constants'
import type { User } from '../types'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { useUsersColumns } from './users-columns'
import { useUsers } from './users-provider'

const route = getRouteApi('/_authenticated/users/')

function isDisabledUserRow(user: User) {
  return isUserDeleted(user) || user.status === USER_STATUS.DISABLED
}

export function UsersTable() {
  const { t } = useTranslation()
  const columns = useUsersColumns()
  const { refreshTrigger } = useUsers()
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
    persistKey: 'users-filters',
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'role', searchKey: 'role', type: 'array' },
      { columnId: 'group', searchKey: 'group', type: 'string' },
    ],
  })
  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const roleFilter =
    (columnFilters.find((filter) => filter.id === 'role')?.value as
      | string[]
      | undefined) ?? []
  const groupFilter =
    (columnFilters.find((filter) => filter.id === 'group')?.value as string) ??
    ''

  // Fetch data with React Query
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'users',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilter,
      roleFilter,
      groupFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      const hasFilter = globalFilter?.trim()
      const hasColumnFilter =
        statusFilter.length > 0 || roleFilter.length > 0 || Boolean(groupFilter)
      const params = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }

      const result =
        hasFilter || hasColumnFilter
          ? await searchUsers({
              ...params,
              keyword: globalFilter,
              status: statusFilter[0] ?? '',
              role: roleFilter[0] ?? '',
              group: groupFilter,
            })
          : await getUsers(params)

      if (!result.success) {
        toast.error(
          result.message || `Failed to ${hasFilter ? 'search' : 'load'} users`
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

  const users = data?.items || []
  const totalCount = data?.total || 0

  const table = useReactTable({
    data: users,
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
      const searchValue = String(filterValue).toLowerCase()
      const fields = [
        row.getValue('username'),
        row.original.display_name,
        row.original.email,
      ]
      return fields.some((field) =>
        String(field || '')
          .toLowerCase()
          .includes(searchValue)
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

  const handleRoleFilterChange = (value: string) => {
    const column = table.getColumn('role')
    if (!column) return
    if (value === 'all') {
      column.setFilterValue([])
    } else {
      column.setFilterValue([value])
    }
  }

  const currentStatusValue =
    statusFilter.length > 0 && !statusFilter.includes('all')
      ? statusFilter[0]
      : 'all'
  const currentRoleValue =
    roleFilter.length > 0 && !roleFilter.includes('all')
      ? roleFilter[0]
      : 'all'

  // Is filtered?
  const isFiltered =
    !!globalFilter ||
    columnFilters.some((f) => {
      const value = f.value as string[]
      return value && value.length > 0 && !value.includes('all')
    })

  // Reset filters
  const handleReset = () => {
    table.resetColumnFilters()
    table.setGlobalFilter('')
  }

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
      {/* Filter Bar */}
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative'>
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className='pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground'
          />
          <Input
            placeholder={t('Filter by username, name or email...')}
            value={globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            className='h-8 w-full pl-8 text-xs sm:w-[240px] lg:w-[280px]'
          />
        </div>

        <Select
          value={currentStatusValue}
          onValueChange={handleStatusFilterChange}
        >
          <SelectTrigger className='h-8 w-[130px] text-xs'>
            <SelectValue>
              {(value: string) => {
                if (value === 'all') return t('All Status')
                const opt = getUserStatusOptions(t).find(
                  (o) => o.value === value
                )
                return opt ? opt.label : value
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('All Status')}</SelectItem>
            {[...getUserStatusOptions(t)].map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentRoleValue}
          onValueChange={handleRoleFilterChange}
        >
          <SelectTrigger className='h-8 w-[130px] text-xs'>
            <SelectValue>
              {(value: string) => {
                if (value === 'all') return t('All Roles')
                const opt = getUserRoleOptions(t).find(
                  (o) => o.value === value
                )
                return opt ? opt.label : value
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('All Roles')}</SelectItem>
            {[...getUserRoleOptions(t)].map((opt) => (
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
            {t('Total {{count}} users', { count: totalCount })}
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
                    keyPrefix='users-skeleton'
                  />
                ) : rows.length === 0 ? (
                  <TableEmpty
                    colSpan={columns.length}
                    title={t('No Users Found')}
                    description={t(
                      'No users available. Try adjusting your search or filters.'
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
                        isDisabledUserRow(row.original)
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

        {/* Mobile Card List */}
        {isMobile && (
          <MobileCardList
            table={table}
            isLoading={isLoading}
            emptyTitle={t('No Users Found')}
            emptyDescription={t(
              'No users available. Try adjusting your search or filters.'
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
