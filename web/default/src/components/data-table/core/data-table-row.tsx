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
import { flexRender, type Row } from '@tanstack/react-table'
import { TableCell, TableRow } from '@/components/ui/table'
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
          className={getColumnClassName?.(cell.column.id, 'cell')}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
