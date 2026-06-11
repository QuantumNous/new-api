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
import { type Row } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import {
  getPinnedColumnMap,
  getResolvedColumnClassNameFromMap,
} from './column-pinning'
import { DataTableColgroup } from './data-table-colgroup'
import { DataTableHeader } from './data-table-header'
import { DataTableRow } from './data-table-row'
import { TableEmpty } from './table-empty'
import { getTableSizeStyle } from './table-sizing'
import { TableSkeleton } from './table-skeleton'
import type {
  DataTableColumnClassName,
  DataTablePinnedColumn,
  DataTableViewProps,
} from './types'

export type {
  DataTableColumnClassName,
  DataTablePinnedColumn,
  DataTableRenderRowHelpers,
  DataTableViewProps,
} from './types'
export { DataTableRow } from './data-table-row'

export function DataTableView<TData>(props: DataTableViewProps<TData>) {
  const rows = props.rows ?? props.table.getRowModel().rows
  const colSpan = props.table.getVisibleLeafColumns().length
  const columnClassName = useResolvedColumnClassName(
    props.getColumnClassName,
    props.pinnedColumns
  )

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border',
        props.containerClassName
      )}
      {...props.containerProps}
    >
      {props.splitHeader ? (
        <SplitHeaderTableView
          props={props}
          rows={rows}
          colSpan={colSpan}
          getColumnClassName={columnClassName}
        />
      ) : (
        <UnifiedTableView
          props={props}
          rows={rows}
          colSpan={colSpan}
          getColumnClassName={columnClassName}
        />
      )}
    </div>
  )
}

function UnifiedTableView<TData>({
  props,
  rows,
  colSpan,
  getColumnClassName,
}: {
  props: DataTableViewProps<TData>
  rows: Row<TData>[]
  colSpan: number
  getColumnClassName: DataTableColumnClassName
}) {
  const tableSizing = getTableSizing(props)

  return (
    <div className={props.tableContainerClassName}>
      <Table className={props.tableClassName} style={tableSizing.style}>
        {tableSizing.colgroup}
        <DataTableHeader
          table={props.table}
          applyHeaderSize={props.applyHeaderSize}
          className={props.tableHeaderClassName}
          rowClassName={props.tableHeaderRowClassName}
          getColumnClassName={getColumnClassName}
        />
        {renderTableBody(props, rows, colSpan, getColumnClassName)}
      </Table>
    </div>
  )
}

function SplitHeaderTableView<TData>({
  props,
  rows,
  colSpan,
  getColumnClassName,
}: {
  props: DataTableViewProps<TData>
  rows: Row<TData>[]
  colSpan: number
  getColumnClassName: DataTableColumnClassName
}) {
  const headerHostRef = React.useRef<HTMLDivElement>(null)
  const bodyHostRef = React.useRef<HTMLDivElement>(null)
  const tableSizing = getTableSizing(props)

  React.useEffect(() => {
    const headerScroller = headerHostRef.current?.querySelector<HTMLElement>(
      '[data-slot=table-container]'
    )
    const bodyScroller = bodyHostRef.current?.querySelector<HTMLElement>(
      '[data-slot=table-container]'
    )

    if (!headerScroller || !bodyScroller) return

    const syncHeaderScroll = () => {
      headerScroller.scrollLeft = bodyScroller.scrollLeft
    }

    syncHeaderScroll()
    bodyScroller.addEventListener('scroll', syncHeaderScroll, { passive: true })

    return () => {
      bodyScroller.removeEventListener('scroll', syncHeaderScroll)
    }
  }, [rows.length, props.tableClassName, props.colgroup])

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col',
        props.tableContainerClassName
      )}
    >
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          props.splitHeaderScrollClassName
        )}
      >
        <div
          ref={headerHostRef}
          className='[scrollbar-gutter:stable] overflow-hidden [&_[data-slot=table-container]]:overflow-x-hidden'
        >
          <Table className={props.tableClassName} style={tableSizing.style}>
            {tableSizing.colgroup}
            <DataTableHeader
              table={props.table}
              applyHeaderSize={props.applyHeaderSize}
              className={props.tableHeaderClassName}
              rowClassName={props.tableHeaderRowClassName}
              getColumnClassName={getColumnClassName}
            />
          </Table>
        </div>
        <div
          ref={bodyHostRef}
          className={cn(
            'min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto',
            props.bodyContainerClassName
          )}
        >
          <Table className={props.tableClassName} style={tableSizing.style}>
            {tableSizing.colgroup}
            {renderTableBody(props, rows, colSpan, getColumnClassName)}
          </Table>
        </div>
      </div>
    </div>
  )
}

function useResolvedColumnClassName(
  getColumnClassName?: DataTableColumnClassName,
  pinnedColumns?: DataTablePinnedColumn[]
) {
  const pinnedColumnById = React.useMemo(
    () => getPinnedColumnMap(pinnedColumns),
    [pinnedColumns]
  )

  return React.useMemo(
    () =>
      getResolvedColumnClassNameFromMap(getColumnClassName, pinnedColumnById),
    [getColumnClassName, pinnedColumnById]
  )
}

function getTableSizing<TData>(props: DataTableViewProps<TData>): {
  colgroup?: React.ReactNode
  style?: React.CSSProperties
} {
  if (props.colgroup) {
    return { colgroup: props.colgroup }
  }

  if (!props.splitHeader && !props.applyHeaderSize) {
    return {}
  }

  return {
    colgroup: <DataTableColgroup table={props.table} />,
    style: getTableSizeStyle(props.table),
  }
}

function renderTableBody<TData>(
  props: DataTableViewProps<TData>,
  rows: Row<TData>[],
  colSpan: number,
  getColumnClassName: DataTableColumnClassName
) {
  return (
    <TableBody className={props.tableBodyClassName}>
      {renderTableBodyContent(props, rows, colSpan, getColumnClassName)}
    </TableBody>
  )
}

function renderTableBodyContent<TData>(
  props: DataTableViewProps<TData>,
  rows: Row<TData>[],
  colSpan: number,
  getColumnClassName: DataTableColumnClassName
) {
  if (props.isLoading) {
    return (
      <TableSkeleton
        table={props.table}
        keyPrefix={props.skeletonKeyPrefix}
        rowHeight={props.skeletonRowHeight}
      />
    )
  }

  if (rows.length === 0) {
    return renderEmptyState(props, colSpan)
  }

  return rows.map((row) =>
    props.renderRow
      ? props.renderRow(row, {
          getCellClassName: (columnId, className) =>
            cn(getColumnClassName(columnId, 'cell'), className),
        })
      : renderDefaultRow(props, row, getColumnClassName)
  )
}

function renderEmptyState<TData>(
  props: DataTableViewProps<TData>,
  colSpan: number
) {
  if (props.emptyContent) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className={props.emptyCellClassName}>
          {props.emptyContent}
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableEmpty
      colSpan={colSpan}
      title={props.emptyTitle}
      description={props.emptyDescription}
      icon={props.emptyIcon}
    >
      {props.emptyAction}
    </TableEmpty>
  )
}

function renderDefaultRow<TData>(
  props: DataTableViewProps<TData>,
  row: Row<TData>,
  getColumnClassName: DataTableColumnClassName
) {
  return (
    <DataTableRow
      key={row.id}
      row={row}
      className={cn(props.tableBodyRowClassName, props.getRowClassName?.(row))}
      getColumnClassName={getColumnClassName}
    />
  )
}
