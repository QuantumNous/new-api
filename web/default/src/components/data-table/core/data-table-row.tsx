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
import { flexRender, type Row } from '@tanstack/react-table'
import * as React from 'react'

import { TableCell, TableRow } from '@/components/design-system/table'
import { cn } from '@/lib/utils'

import type { DataTableColumnClassName } from './types'

type DataTableRowProps<TData> = {
  row: Row<TData>
  className?: string
  getColumnClassName?: DataTableColumnClassName
} & Omit<React.ComponentProps<typeof TableRow>, 'children'>

type DataTableRowInnerProps<TData> = DataTableRowProps<TData> & {
  isSelected: boolean
}

function DataTableRowInner<TData>({
  row,
  isSelected,
  className,
  getColumnClassName,
  ...rowProps
}: DataTableRowInnerProps<TData>) {
  return (
    <TableRow
      data-state={isSelected ? 'selected' : undefined}
      className={className}
      {...rowProps}
    >
      {row.getVisibleCells().map((cell) => {
        const contentMode = cell.column.columnDef.meta?.contentMode ?? 'wrap'

        return (
          <TableCell
            key={cell.id}
            data-column-id={cell.column.id}
            data-content-mode={contentMode}
            className={cn(
              'max-w-full min-w-0',
              contentMode === 'full' &&
                'max-w-none overflow-visible [&_.truncate]:overflow-visible [&_.truncate]:text-clip',
              contentMode === 'wrap' &&
                'whitespace-normal break-words [overflow-wrap:anywhere] [&_.truncate]:overflow-visible [&_.truncate]:text-clip [&_.truncate]:whitespace-normal',
              contentMode === 'summary' &&
                'whitespace-normal break-words [overflow-wrap:anywhere]',
              getColumnClassName?.(cell.column.id, 'cell')
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        )
      })}
    </TableRow>
  )
}

export function DataTableRow<TData>(props: DataTableRowProps<TData>) {
  return <DataTableRowInner {...props} isSelected={props.row.getIsSelected()} />
}
