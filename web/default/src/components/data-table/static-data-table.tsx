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
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { staticDataTableClassNames } from './static-data-table-classnames'

type StaticDataTableProps<TData = unknown> = {
  children?: React.ReactNode
  columns?: StaticDataTableColumn<TData>[]
  data?: TData[]
  getRowKey?: (row: TData, index: number) => React.Key
  getRowClassName?: (row: TData, index: number) => string | undefined
  renderRow?: (row: TData, index: number) => React.ReactNode
  empty?: boolean
  emptyContent?: React.ReactNode
  emptyClassName?: string
  headerRowClassName?: string
  className?: string
  tableClassName?: string
  containerProps?: Omit<React.ComponentProps<'div'>, 'className' | 'children'>
  tableProps?: Omit<
    React.ComponentProps<typeof Table>,
    'className' | 'children'
  >
}

export type StaticDataTableColumn<TData = unknown> = {
  id: string
  header: React.ReactNode
  className?: string
  cellClassName?: string | ((row: TData, index: number) => string | undefined)
  cell?: (row: TData, index: number) => React.ReactNode
}

export function StaticDataTable<TData = unknown>({
  children,
  columns,
  data,
  getRowKey,
  getRowClassName,
  renderRow,
  empty,
  emptyContent,
  emptyClassName,
  headerRowClassName,
  className,
  tableClassName,
  containerProps,
  tableProps,
}: StaticDataTableProps<TData>) {
  const bodyRows = data
    ? renderStaticDataRows({
        data,
        columns,
        getRowKey,
        getRowClassName,
        renderRow,
      })
    : children
  const isEmpty = empty ?? (data !== undefined && data.length === 0)

  const content = columns ? (
    <>
      <TableHeader>
        <TableRow className={headerRowClassName}>
          {columns.map((column) => (
            <TableHead key={column.id} className={column.className}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isEmpty ? (
          <StaticDataTableEmptyRow
            colSpan={columns.length}
            className={emptyClassName}
          >
            {emptyContent}
          </StaticDataTableEmptyRow>
        ) : (
          bodyRows
        )}
      </TableBody>
    </>
  ) : (
    bodyRows
  )

  return (
    <div
      className={cn(staticDataTableClassNames.container, className)}
      {...containerProps}
    >
      <Table className={tableClassName} {...tableProps}>
        {content}
      </Table>
    </div>
  )
}

function renderStaticDataRows<TData>({
  data,
  columns,
  getRowKey,
  getRowClassName,
  renderRow,
}: Pick<
  StaticDataTableProps<TData>,
  'data' | 'columns' | 'getRowKey' | 'getRowClassName' | 'renderRow'
>) {
  return data?.map((row, index) => {
    const key = getRowKey?.(row, index) ?? index

    if (renderRow) {
      return <React.Fragment key={key}>{renderRow(row, index)}</React.Fragment>
    }

    return (
      <TableRow key={key} className={getRowClassName?.(row, index)}>
        {columns?.map((column) => (
          <TableCell
            key={column.id}
            className={getStaticCellClassName(column, row, index)}
          >
            {column.cell?.(row, index)}
          </TableCell>
        ))}
      </TableRow>
    )
  })
}

function getStaticCellClassName<TData>(
  column: StaticDataTableColumn<TData>,
  row: TData,
  index: number
) {
  return typeof column.cellClassName === 'function'
    ? column.cellClassName(row, index)
    : column.cellClassName
}

type StaticDataTableEmptyRowProps = {
  colSpan: number
  children: React.ReactNode
  className?: string
}

function StaticDataTableEmptyRow({
  colSpan,
  children,
  className,
}: StaticDataTableEmptyRowProps) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className={cn('h-24 text-center', className)}
      >
        {children}
      </TableCell>
    </TableRow>
  )
}
