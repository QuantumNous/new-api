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
import { cn } from '@/lib/utils'
import type { DataTableColumnClassName, DataTablePinnedColumn } from './types'

export function getResolvedColumnClassName(
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
