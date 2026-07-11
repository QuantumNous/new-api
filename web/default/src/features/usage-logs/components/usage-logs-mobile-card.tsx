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
  type Cell,
  type Row,
  type Table,
} from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import {
  DataTableCardField,
  DataTableCardRow,
  MobileCardList,
} from '@/components/data-table'
import { cn } from '@/lib/utils'

import { LOG_TYPE_ENUM } from '../constants'

const logTypeRowTint: Record<number, string> = {
  [LOG_TYPE_ENUM.ERROR]: 'bg-destructive/5 border-destructive/20',
  [LOG_TYPE_ENUM.REFUND]: 'bg-info/5 border-info/20',
}

interface UsageLogsMobileListProps<TData> {
  table: Table<TData>
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  getRowClassName?: (row: Row<TData>) => string | undefined
}

type CardRole = 'title' | 'badge' | 'primary' | 'secondary' | 'hidden'

function getCardRole<TData>(cell: Cell<TData, unknown>): CardRole {
  return cell.column.columnDef.meta?.cardRole ?? 'primary'
}

function getCardLabel<TData>(cell: Cell<TData, unknown>): string {
  const metaLabel = cell.column.columnDef.meta?.label
  if (metaLabel) return metaLabel

  const header = cell.column.columnDef.header
  return typeof header === 'string' ? header : cell.column.id
}

function orderCardCells<TData>(
  cells: Cell<TData, unknown>[]
): Cell<TData, unknown>[] {
  return [...cells].sort((a, b) => {
    const aOrder = a.column.columnDef.meta?.cardOrder
    const bOrder = b.column.columnDef.meta?.cardOrder
    if (aOrder == null && bOrder == null) return 0
    if (aOrder == null) return 1
    if (bOrder == null) return -1
    return aOrder - bOrder
  })
}

function isWideField<TData>(cell: Cell<TData, unknown>): boolean {
  const meta = cell.column.columnDef.meta
  return meta?.cardSpan === 2 || meta?.contentMode === 'summary'
}

function UsageLogCard<TData>(props: { cells: Cell<TData, unknown>[] }) {
  const titleCell = props.cells.find((cell) => getCardRole(cell) === 'title')
  const badgeCell = props.cells.find((cell) => getCardRole(cell) === 'badge')
  const bodyCells = orderCardCells(
    props.cells.filter(
      (cell) =>
        getCardRole(cell) !== 'title' &&
        getCardRole(cell) !== 'badge' &&
        getCardRole(cell) !== 'hidden'
    )
  )
  const rowCells = bodyCells.filter((cell) => !isWideField(cell))
  const wideCells = bodyCells.filter((cell) => isWideField(cell))

  return (
    <div className='flex min-w-0 flex-col'>
      {(titleCell || badgeCell) && (
        <div className='flex min-w-0 items-start justify-between gap-3'>
          {titleCell && (
            <div className='min-w-0 flex-1 text-base leading-tight font-semibold break-words'>
              {flexRender(
                titleCell.column.columnDef.cell,
                titleCell.getContext()
              )}
            </div>
          )}
          {badgeCell && (
            <div className='max-w-1/2 shrink text-right tabular-nums'>
              {flexRender(
                badgeCell.column.columnDef.cell,
                badgeCell.getContext()
              )}
            </div>
          )}
        </div>
      )}

      {bodyCells.length > 0 && (
        <div
          className={cn(
            'flex flex-col gap-3',
            (titleCell || badgeCell) && 'mt-3'
          )}
        >
          {rowCells.length > 0 && (
            <div className='flex flex-col gap-0.5'>
              {rowCells.map((cell) => (
                <DataTableCardRow
                  key={cell.id}
                  label={getCardLabel(cell)}
                  contentMode={cell.column.columnDef.meta?.contentMode}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </DataTableCardRow>
              ))}
            </div>
          )}

          {wideCells.length > 0 && (
            <div className='bg-muted/30 flex flex-col gap-3 rounded-md px-2.5 py-2'>
              {wideCells.map((cell) => (
                <DataTableCardField
                  key={cell.id}
                  label={getCardLabel(cell)}
                  contentMode={
                    cell.column.columnDef.meta?.contentMode ?? 'full'
                  }
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </DataTableCardField>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function UsageLogsMobileList<TData>({
  table,
  isLoading = false,
  emptyTitle,
  emptyDescription,
  getRowClassName,
}: UsageLogsMobileListProps<TData>) {
  const { t } = useTranslation()

  const resolvedEmptyTitle = emptyTitle ?? t('No Logs Found')
  const resolvedEmptyDescription =
    emptyDescription ??
    t('No usage logs available. Logs will appear here once API calls are made.')

  return (
    <MobileCardList
      table={table}
      isLoading={isLoading}
      emptyTitle={resolvedEmptyTitle}
      emptyDescription={resolvedEmptyDescription}
      renderCard={(row) => <UsageLogCard cells={row.getVisibleCells()} />}
      getRowClassName={(row) => {
        const logType = (row.original as Record<string, unknown>).type as
          | number
          | undefined
        const tintClass = logType != null ? (logTypeRowTint[logType] ?? '') : ''
        return cn(
          'border-l-2 border-l-transparent transition-colors',
          tintClass,
          getRowClassName?.(row)
        )
      }}
    />
  )
}
