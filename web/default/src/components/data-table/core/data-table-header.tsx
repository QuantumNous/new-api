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
import {
  flexRender,
  type Header,
  type Table as TanstackTable,
} from '@tanstack/react-table'
import { TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableColumnHeader } from './column-header'
import type { DataTableColumnClassName } from './types'

type DataTableHeaderProps<TData> = {
  table: TanstackTable<TData>
  applyHeaderSize?: boolean
  className?: string
  rowClassName?: string
  getColumnClassName?: DataTableColumnClassName
}

export function DataTableHeader<TData>({
  table,
  applyHeaderSize,
  className,
  rowClassName,
  getColumnClassName,
}: DataTableHeaderProps<TData>) {
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
              {renderHeaderContent(header)}
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
  )
}

function renderHeaderContent<TData>(header: Header<TData, unknown>) {
  if (header.isPlaceholder) return null
  const { header: headerDef, meta } = header.column.columnDef
  // A string header means the user wrote e.g. `header: t('Name')` — auto-render
  // with DataTableColumnHeader so sorting works without boilerplate.
  // A function (including TanStack's default accessor-key fallback) is passed
  // through as-is. meta.label is kept as a fallback for legacy columns.
  if (typeof headerDef === 'string') {
    return <DataTableColumnHeader column={header.column} title={headerDef} />
  }
  if (meta?.label) {
    return <DataTableColumnHeader column={header.column} title={meta.label} />
  }
  return flexRender(headerDef, header.getContext())
}
