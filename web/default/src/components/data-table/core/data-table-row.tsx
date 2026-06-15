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
import { flexRender, type Cell, type Row } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { TableCell, TableRow } from '@/components/ui/table'
import { TruncatedCell } from './truncated-cell'
import type { DataTableColumnClassName } from './types'

type DataTableRowProps<TData> = {
  row: Row<TData>
  className?: string
  getColumnClassName?: DataTableColumnClassName
} & Omit<React.ComponentProps<typeof TableRow>, 'children'>

function DataTableRowInner<TData>({
  row,
  className,
  getColumnClassName,
  ...rowProps
}: DataTableRowProps<TData>) {
  return (
    <TableRow
      data-state={row.getIsSelected() ? 'selected' : undefined}
      className={className}
      {...rowProps}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            'max-w-full min-w-0 overflow-hidden',
            getColumnClassName?.(cell.column.id, 'cell')
          )}
        >
          {renderCellContent(cell)}
        </TableCell>
      ))}
    </TableRow>
  )
}

export const DataTableRow = React.memo(DataTableRowInner, (prev, next) => {
  // Skip re-render when only the getColumnClassName reference changed but the
  // row identity and selection state are the same — callers rarely stabilize
  // this callback, so excluding it from comparison avoids unnecessary renders.
  return (
    prev.row === next.row &&
    prev.className === next.className &&
    prev.row.getIsSelected() === next.row.getIsSelected()
  )
}) as typeof DataTableRowInner

function renderCellContent<TData>(cell: Cell<TData, unknown>) {
  const content = flexRender(cell.column.columnDef.cell, cell.getContext())
  const textContent = getPrimitiveTextContent(content)

  if (!textContent) return content

  return <TruncatedCell tooltipContent={textContent}>{content}</TruncatedCell>
}

function getPrimitiveTextContent(content: React.ReactNode): string | null {
  if (typeof content === 'string' || typeof content === 'number') {
    return String(content)
  }

  if (
    React.isValidElement<{ children?: React.ReactNode }>(content) &&
    (typeof content.props.children === 'string' ||
      typeof content.props.children === 'number')
  ) {
    return String(content.props.children)
  }

  return null
}
