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
  flexRender,
  type Row,
  type Table as TanstackTable,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableEmpty } from './table-empty'
import { TableSkeleton } from './table-skeleton'

export type DataTableColumnClassName = (
  columnId: string,
  kind: 'header' | 'cell'
) => string | undefined

export type DataTablePinnedColumn = {
  columnId: string
  side: 'left' | 'right'
  className?: string
  headerClassName?: string
  cellClassName?: string
}

export type DataTableRenderRowHelpers = {
  getCellClassName: (columnId: string, className?: string) => string | undefined
}

export type DataTableViewProps<TData> = {
  table: TanstackTable<TData>
  isLoading?: boolean
  rows?: Row<TData>[]
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: React.ReactNode
  emptyAction?: React.ReactNode
  emptyContent?: React.ReactNode
  emptyCellClassName?: string
  skeletonKeyPrefix?: string
  skeletonRowHeight?: string
  renderRow?: (
    row: Row<TData>,
    helpers: DataTableRenderRowHelpers
  ) => React.ReactNode
  getRowClassName?: (row: Row<TData>) => string | undefined
  getColumnClassName?: DataTableColumnClassName
  pinnedColumns?: DataTablePinnedColumn[]
  applyHeaderSize?: boolean
  tableClassName?: string
  tableHeaderClassName?: string
  tableHeaderRowClassName?: string
  tableBodyClassName?: string
  tableBodyRowClassName?: string
  splitHeader?: boolean
  splitHeaderScrollClassName?: string
  bodyContainerClassName?: string
  containerClassName?: string
  containerProps?: Omit<React.ComponentProps<'div'>, 'className' | 'children'>
  tableContainerClassName?: string
  colgroup?: React.ReactNode
}

export function DataTableView<TData>(props: DataTableViewProps<TData>) {
  const rows = props.rows ?? props.table.getRowModel().rows
  const colSpan = props.table.getVisibleLeafColumns().length

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border',
        props.containerClassName
      )}
      {...props.containerProps}
    >
      {props.splitHeader ? (
        <SplitHeaderTableView props={props} rows={rows} colSpan={colSpan} />
      ) : (
        <UnifiedTableView props={props} rows={rows} colSpan={colSpan} />
      )}
    </div>
  )
}

function UnifiedTableView<TData>({
  props,
  rows,
  colSpan,
}: {
  props: DataTableViewProps<TData>
  rows: Row<TData>[]
  colSpan: number
}) {
  const getColumnClassName = getResolvedColumnClassName(
    props.getColumnClassName,
    props.pinnedColumns
  )

  return (
    <div className={props.tableContainerClassName}>
      <Table className={props.tableClassName}>
        {props.colgroup}
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
}: {
  props: DataTableViewProps<TData>
  rows: Row<TData>[]
  colSpan: number
}) {
  const headerHostRef = React.useRef<HTMLDivElement>(null)
  const bodyHostRef = React.useRef<HTMLDivElement>(null)
  const getColumnClassName = getResolvedColumnClassName(
    props.getColumnClassName,
    props.pinnedColumns
  )

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
          className='[scrollbar-gutter:stable] overflow-hidden'
        >
          <Table className={props.tableClassName}>
            {props.colgroup}
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
            'min-h-0 flex-1 overflow-y-auto',
            props.bodyContainerClassName
          )}
        >
          <Table className={props.tableClassName}>
            {props.colgroup}
            {renderTableBody(props, rows, colSpan, getColumnClassName)}
          </Table>
        </div>
      </div>
    </div>
  )
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

function getResolvedColumnClassName(
  getColumnClassName?: DataTableColumnClassName,
  pinnedColumns?: DataTablePinnedColumn[]
): DataTableColumnClassName {
  if (!pinnedColumns?.length) {
    return (columnId, kind) => getColumnClassName?.(columnId, kind)
  }

  const pinnedColumnById = new Map(
    pinnedColumns.map((column) => [column.columnId, column])
  )

  return (columnId, kind) => {
    const pinnedColumn = pinnedColumnById.get(columnId)
    const customClassName = getColumnClassName?.(columnId, kind)

    if (!pinnedColumn) return customClassName

    return cn(customClassName, getPinnedColumnClassName(pinnedColumn, kind))
  }
}

function getPinnedColumnClassName(
  pinnedColumn: DataTablePinnedColumn,
  kind: 'header' | 'cell'
) {
  const edgeClassName =
    pinnedColumn.side === 'left'
      ? 'border-r shadow-[8px_0_10px_-10px_hsl(var(--foreground))]'
      : 'border-l shadow-[-8px_0_10px_-10px_hsl(var(--foreground))]'

  return cn(
    'sticky whitespace-nowrap',
    pinnedColumn.side === 'left' ? 'left-0' : 'right-0',
    edgeClassName,
    kind === 'header'
      ? 'bg-background z-30'
      : 'bg-background z-10 group-hover:bg-muted group-data-[state=selected]:bg-muted',
    pinnedColumn.className,
    kind === 'header'
      ? pinnedColumn.headerClassName
      : pinnedColumn.cellClassName
  )
}

function DataTableHeader<TData>({
  table,
  applyHeaderSize,
  className,
  rowClassName,
  getColumnClassName,
}: {
  table: TanstackTable<TData>
  applyHeaderSize?: boolean
  className?: string
  rowClassName?: string
  getColumnClassName?: DataTableColumnClassName
}) {
  return (
    <TableHeader className={className}>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id} className={rowClassName}>
          {headerGroup.headers.map((header) => (
            <TableHead
              key={header.id}
              colSpan={header.colSpan}
              className={getColumnClassName?.(header.column.id, 'header')}
              style={applyHeaderSize ? { width: header.getSize() } : undefined}
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
  )
}

export function DataTableRow<TData>({
  row,
  className,
  getColumnClassName,
  ...rowProps
}: {
  row: Row<TData>
  className?: string
  getColumnClassName?: DataTableColumnClassName
} & Omit<React.ComponentProps<typeof TableRow>, 'children'>) {
  return (
    <TableRow
      data-state={row.getIsSelected() ? 'selected' : undefined}
      className={className}
      {...rowProps}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={getColumnClassName?.(cell.column.id, 'cell')}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}
