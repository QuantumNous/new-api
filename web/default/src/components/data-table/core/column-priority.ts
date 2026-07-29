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
import type { ColumnDef, VisibilityState } from '@tanstack/react-table'

/**
 * Column display priority for list pages.
 *
 * - `primary` — always shown by default (identity, status, key actions)
 * - `secondary` — useful but not required; hidden by default to avoid
 *   horizontal scrolling; users can enable via column view options
 * - `detail` — deep metadata; hidden by default; prefer row menus / sheets
 */
export type DataTableColumnPriority = 'primary' | 'secondary' | 'detail'

export type DataTableColumnMeta = {
  priority?: DataTableColumnPriority
  /** Mobile card: use as the card title. */
  mobileTitle?: boolean
  /** Mobile card: render as the trailing badge. */
  mobileBadge?: boolean
  /** Mobile card: skip this column in the body. */
  mobileHidden?: boolean
  pinned?: 'left' | 'right'
  [key: string]: unknown
}

type ColumnWithMeta<TData> = ColumnDef<TData, unknown> & {
  id?: string
  accessorKey?: string | number
  columns?: ColumnDef<TData, unknown>[]
  meta?: DataTableColumnMeta
  enableHiding?: boolean
}

function resolveColumnId<TData>(
  column: ColumnWithMeta<TData>
): string | undefined {
  if (typeof column.id === 'string') return column.id
  if (typeof column.accessorKey === 'string') {
    return column.accessorKey.replaceAll('.', '_')
  }
  if (typeof column.accessorKey === 'number') {
    return String(column.accessorKey)
  }
  return undefined
}

/**
 * Build a default visibility map that keeps only primary columns visible.
 * Secondary and detail columns start hidden so list pages fit without
 * horizontal scrolling. Explicit `false` is never forced on non-hideable
 * columns (select / actions).
 */
export function getPriorityColumnVisibility<TData>(
  columns: ColumnDef<TData, unknown>[]
): VisibilityState {
  const visibility: VisibilityState = {}

  const visit = (cols: ColumnDef<TData, unknown>[]) => {
    for (const col of cols) {
      const column = col as ColumnWithMeta<TData>
      const id = resolveColumnId(column)
      const priority = column.meta?.priority
      const canHide = column.enableHiding !== false

      if (
        id &&
        canHide &&
        (priority === 'secondary' || priority === 'detail')
      ) {
        visibility[id] = false
      }

      if (Array.isArray(column.columns)) {
        visit(column.columns)
      }
    }
  }

  visit(columns)
  return visibility
}
