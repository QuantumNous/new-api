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
import * as React from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  type Updater,
  type VisibilityState,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

type DataTableFeatureOptions<TData> = Pick<
  TableOptions<TData>,
  | 'enableRowSelection'
  | 'getRowId'
  | 'getSubRows'
  | 'globalFilterFn'
  | 'autoResetPageIndex'
  | 'manualFiltering'
  | 'manualPagination'
  | 'manualSorting'
>

type DataTableStateOptions = {
  initialSorting?: SortingState
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  initialColumnVisibility?: VisibilityState
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  initialRowSelection?: RowSelectionState
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  initialExpanded?: ExpandedState
  expanded?: ExpandedState
  onExpandedChange?: OnChangeFn<ExpandedState>
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
  globalFilter?: string
  onGlobalFilterChange?: OnChangeFn<string>
  initialPagination?: PaginationState
  pagination?: PaginationState
  onPaginationChange?: OnChangeFn<PaginationState>
}

type DataTableRowModelOptions = {
  withFilteredRowModel?: boolean
  withPaginationRowModel?: boolean
  withSortedRowModel?: boolean
  withFacetedRowModel?: boolean
  withExpandedRowModel?: boolean
}

type UseDataTableOptions<TData> = DataTableFeatureOptions<TData> &
  DataTableStateOptions &
  DataTableRowModelOptions & {
    data: TData[]
    columns: ColumnDef<TData, unknown>[]
    totalCount?: number
    pageCount?: number
    ensurePageInRange?: (pageCount: number) => void
  }

function resolveUpdater<TValue>(
  updater: Updater<TValue>,
  previous: TValue
): TValue {
  return typeof updater === 'function'
    ? (updater as (old: TValue) => TValue)(previous)
    : updater
}

function useControllableTableState<TValue>(
  controlledValue: TValue | undefined,
  defaultValue: TValue,
  onChange: OnChangeFn<TValue> | undefined
): [TValue, OnChangeFn<TValue>] {
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState<TValue>(defaultValue)

  const value = controlledValue ?? uncontrolledValue

  const setValue = React.useCallback<OnChangeFn<TValue>>(
    (updater) => {
      if (controlledValue === undefined) {
        setUncontrolledValue((previous) => resolveUpdater(updater, previous))
      }
      onChange?.(updater)
    },
    [controlledValue, onChange]
  )

  return [value, setValue]
}

export function useDataTable<TData>(options: UseDataTableOptions<TData>) {
  const {
    data,
    columns,
    totalCount,
    pageCount: explicitPageCount,
    ensurePageInRange,
    manualFiltering,
    manualPagination,
    manualSorting,
    initialSorting = [],
    initialColumnVisibility = {},
    initialRowSelection = {},
    initialExpanded = {},
    initialPagination = { pageIndex: 0, pageSize: 20 },
    withFilteredRowModel = !manualFiltering,
    withPaginationRowModel = !manualPagination,
    withSortedRowModel = !manualSorting,
    withFacetedRowModel = !manualFiltering,
    withExpandedRowModel = false,
  } = options

  const [sorting, onSortingChange] = useControllableTableState(
    options.sorting,
    initialSorting,
    options.onSortingChange
  )
  const [columnVisibility, onColumnVisibilityChange] =
    useControllableTableState(
      options.columnVisibility,
      initialColumnVisibility,
      options.onColumnVisibilityChange
    )
  const [rowSelection, onRowSelectionChange] = useControllableTableState(
    options.rowSelection,
    initialRowSelection,
    options.onRowSelectionChange
  )
  const [expanded, onExpandedChange] = useControllableTableState(
    options.expanded,
    initialExpanded,
    options.onExpandedChange
  )
  const [pagination, onPaginationChange] = useControllableTableState(
    options.pagination,
    initialPagination,
    options.onPaginationChange
  )

  const resolvedPageCount =
    explicitPageCount ??
    (totalCount !== undefined
      ? Math.ceil(totalCount / pagination.pageSize)
      : undefined)

  const table = useReactTable({
    data,
    columns,
    rowCount: totalCount,
    pageCount: resolvedPageCount,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      expanded,
      columnFilters: options.columnFilters,
      globalFilter: options.globalFilter,
      pagination,
    },
    enableRowSelection: options.enableRowSelection,
    getRowId: options.getRowId,
    getSubRows: options.getSubRows,
    globalFilterFn: options.globalFilterFn,
    autoResetPageIndex: options.autoResetPageIndex,
    manualFiltering,
    manualPagination,
    manualSorting,
    onSortingChange,
    onColumnVisibilityChange,
    onRowSelectionChange,
    onExpandedChange,
    onColumnFiltersChange: options.onColumnFiltersChange,
    onGlobalFilterChange: options.onGlobalFilterChange,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: withFilteredRowModel
      ? getFilteredRowModel()
      : undefined,
    getPaginationRowModel: withPaginationRowModel
      ? getPaginationRowModel()
      : undefined,
    getSortedRowModel: withSortedRowModel ? getSortedRowModel() : undefined,
    getFacetedRowModel: withFacetedRowModel ? getFacetedRowModel() : undefined,
    getFacetedUniqueValues: withFacetedRowModel
      ? getFacetedUniqueValues()
      : undefined,
    getExpandedRowModel: withExpandedRowModel
      ? getExpandedRowModel()
      : undefined,
  })

  const actualPageCount = table.getPageCount()
  React.useEffect(() => {
    ensurePageInRange?.(actualPageCount)
  }, [actualPageCount, ensurePageInRange])

  return {
    table,
  }
}
