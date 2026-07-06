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
import { useTranslation } from 'react-i18next'

import { TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { DataTableColumnHeader } from './column-header'
import { isContentSizedColumn } from './content-sized-columns'
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
  const { t } = useTranslation()

  return (
    <TableHeader className={className}>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id} className={rowClassName}>
          {headerGroup.headers.map((header) => (
            <TableHead
              key={header.id}
              colSpan={header.colSpan}
              className={cn(
                'relative',
                getColumnClassName?.(header.column.id, 'header')
              )}
              style={getHeaderSizeStyle(header, applyHeaderSize)}
            >
              {renderHeaderContent(header)}
              {shouldRenderColumnResizer(table, header) && (
                <div
                  role='separator'
                  aria-orientation='vertical'
                  aria-label={t('Resize column')}
                  onDoubleClick={() => header.column.resetSize()}
                  onMouseDown={header.getResizeHandler()}
                  onTouchStart={header.getResizeHandler()}
                  className={cn(
                    'absolute top-0 right-0 h-full w-2 cursor-col-resize touch-none select-none',
                    'after:bg-border hover:after:bg-primary after:absolute after:top-2 after:right-0 after:h-[calc(100%-1rem)] after:w-px after:transition-colors',
                    header.column.getIsResizing() && 'after:bg-primary'
                  )}
                />
              )}
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
  )
}

function shouldRenderColumnResizer<TData>(
  table: TanstackTable<TData>,
  header: Header<TData, unknown>
) {
  return (
    table.options.enableColumnResizing === true &&
    !header.isPlaceholder &&
    header.column.getCanResize() &&
    !isContentSizedColumn(header.column.id)
  )
}

function getHeaderSizeStyle<TData>(
  header: Header<TData, unknown>,
  applyHeaderSize: boolean | undefined
) {
  if (!applyHeaderSize || isContentSizedColumn(header.column.id)) {
    return undefined
  }

  return { width: header.getSize() }
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
