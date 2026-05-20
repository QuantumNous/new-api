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
import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  DataTableBulkActions as BulkActionsToolbar,
  DISABLED_ROW_MOBILE,
  DataTablePage,
} from '@/components/data-table'
import type { Table } from '@tanstack/react-table'
import { getUsers, searchUsers } from '../api'
import {
  USER_STATUS,
  ERROR_MESSAGES,
  getUserStatusOptions,
  getUserRoleOptions,
  isUserDeleted,
  resolveUserToastMessage,
} from '../constants'
import type { User } from '../types'
import { useUsersColumns } from './users-columns'
import { useUsers } from './users-provider'

const route = getRouteApi('/_authenticated/users/')

const usersToolbarClassName = cn(
  '[&_input]:border-white/15 [&_input]:bg-slate-950/50 [&_input]:text-slate-100',
  '[&_input::placeholder]:text-slate-500',
  '[&_button]:border-white/15 [&_button]:text-slate-200',
  '[&_button[data-state=open]]:bg-slate-800'
)

const usersTableHeaderClassName = cn(
  'bg-slate-900/80 text-slate-200',
  '[&_th]:border-white/10 [&_th]:text-slate-200',
  '[&_button]:text-slate-200',
  '[&_svg]:text-slate-400',
  '[&_[data-slot=checkbox]]:border-white/25'
)

const usersDisabledRowClassName = cn(
  '[&>td:first-child]:border-l-muted-foreground/35 [&>td:first-child]:border-l-4 [&>td:first-child]:pl-1',
  'bg-slate-900/50 hover:bg-slate-900/60'
)

const usersSelectedRowClassName = cn(
  'data-[state=selected]:!bg-cyan-500/10',
  'data-[state=selected]:hover:!bg-cyan-500/15',
  'data-[state=selected]:!text-slate-100',
  'data-[state=selected]:ring-1 data-[state=selected]:ring-cyan-400/30',
  'data-[state=selected]:!border-cyan-400/20',
  '[&[data-state=selected]_.text-muted-foreground]:!text-slate-300',
  '[&[data-state=selected]_span.text-muted-foreground]:!text-slate-300',
  '[&[data-state=selected]_[data-slot=progress]]:opacity-100'
)

const usersTableClassName = cn(
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
  '[&_[data-slot=table-row][data-state=selected]_[data-slot=checkbox][data-state=checked]]:border-cyan-400',
  '[&_[data-slot=table-row][data-state=selected]_[data-slot=checkbox][data-state=checked]]:bg-cyan-600',
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

function isDisabledUserRow(user: User) {
  return isUserDeleted(user) || user.status === USER_STATUS.DISABLED
}

function UsersBulkActions({ table }: { table: Table<User> }) {
  const { t } = useTranslation()
  const selectionSummary = useCallback(
    (count: number) => t('{{count}} accounts selected', { count }),
    [t]
  )
  return (
    <BulkActionsToolbar
      table={table}
      entityName='account'
      selectionSummary={selectionSummary}
    >
      <></>
    </BulkActionsToolbar>
  )
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
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'role', searchKey: 'role', type: 'array' },
      { columnId: 'group', searchKey: 'group', type: 'string' },
    ],
  })

  // Fetch data with React Query
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'users',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      const hasFilter = globalFilter?.trim()
      const params = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }

      const result = hasFilter
        ? await searchUsers({ ...params, keyword: globalFilter })
        : await getUsers(params)

      if (!result.success) {
        toast.error(
          resolveUserToastMessage(
            result.message,
            hasFilter
              ? ERROR_MESSAGES.SEARCH_FAILED
              : ERROR_MESSAGES.LOAD_FAILED,
            t
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

  const users = data?.items || []

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
    manualPagination: !globalFilter,
    pageCount: Math.ceil((data?.total || 0) / pagination.pageSize),
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
      emptyTitle={t('No Users Found')}
      emptyDescription={t(
        'No users available. Try adjusting your search or filters.'
      )}
      skeletonKeyPrefix='users-skeleton'
      applyHeaderSize
      tableHeaderClassName={usersTableHeaderClassName}
      tableClassName={usersTableClassName}
      toolbarProps={{
        searchPlaceholder: t('Filter by username, name or email...'),
        className: usersToolbarClassName,
        filters: [
          {
            columnId: 'status',
            title: t('Account status'),
            options: getUserStatusOptions(t),
            singleSelect: true,
          },
          {
            columnId: 'role',
            title: t('Account role'),
            options: getUserRoleOptions(t),
            singleSelect: true,
          },
        ],
      }}
      getRowClassName={(row, { isMobile }) => {
        const isSelected = row.getIsSelected()
        const isDisabled = isDisabledUserRow(row.original)

        if (isSelected) {
          return cn(
            usersSelectedRowClassName,
            isDisabled &&
              (isMobile
                ? 'border-l-4 border-l-cyan-500/40'
                : '[&>td:first-child]:border-l-cyan-500/40 [&>td:first-child]:border-l-4')
          )
        }

        if (isDisabled) {
          return isMobile ? DISABLED_ROW_MOBILE : usersDisabledRowClassName
        }

        return undefined
      }}
      bulkActions={<UsersBulkActions table={table} />}
    />
  )
}
