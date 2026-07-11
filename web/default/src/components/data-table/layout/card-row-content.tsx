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
import type { Cell, Row } from '@tanstack/react-table'

import { getCellLabel, renderCellContent } from './card-cell-utils'
import { DataTableCardField, DataTableCardRow } from './card-field'

type CardRole = 'title' | 'badge' | 'primary' | 'secondary' | 'hidden'

function getCardRole<TData>(cell: Cell<TData, unknown>): CardRole {
  const meta = cell.column.columnDef.meta
  if (meta?.cardRole) return meta.cardRole
  return 'primary'
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

/**
 * Shared row content for both the mobile list and optional desktop card grid.
 * All visible fields render immediately — no "More" click to reveal content.
 */
export function CardRowContent<TData>(props: {
  row: Row<TData>
  compact: boolean
}) {
  const cells = props.row
    .getVisibleCells()
    .filter((cell) => cell.column.id !== 'select')
  const titleCell = cells.find((cell) => getCardRole(cell) === 'title')
  const badgeCell = cells.find((cell) => getCardRole(cell) === 'badge')
  const actionsCell = cells.find((cell) => cell.column.id === 'actions')
  const bodyCells = orderCardCells(
    cells.filter(
      (cell) =>
        cell !== titleCell &&
        cell !== badgeCell &&
        cell !== actionsCell &&
        getCardRole(cell) !== 'hidden'
    )
  )
  const rowCells = bodyCells.filter((cell) => !isWideField(cell))
  const wideCells = bodyCells.filter((cell) => isWideField(cell))

  return (
    <div className='flex min-w-0 flex-col'>
      {props.compact && (titleCell || badgeCell) && (
        <div className='flex min-w-0 flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0 flex-1 text-[15px] leading-tight font-semibold [overflow-wrap:anywhere] break-words whitespace-normal [&_.truncate]:overflow-visible [&_.truncate]:text-clip [&_.truncate]:whitespace-normal'>
            {titleCell ? renderCellContent(titleCell) : null}
          </div>
          {badgeCell && (
            <div className='shrink-0 text-right'>
              {renderCellContent(badgeCell)}
            </div>
          )}
        </div>
      )}

      {!props.compact && (
        <div className='grid grid-cols-2 gap-x-3 gap-y-2'>
          {bodyCells.map((cell) => {
            const meta = cell.column.columnDef.meta
            return (
              <DataTableCardField
                key={cell.id}
                label={getCellLabel(cell)}
                contentMode={meta?.contentMode}
                span={meta?.cardSpan}
              >
                {renderCellContent(cell)}
              </DataTableCardField>
            )
          })}
        </div>
      )}

      {props.compact && rowCells.length > 0 && (
        <div className='mt-3 space-y-0.5 border-t pt-3'>
          {rowCells.map((cell) => (
            <DataTableCardRow
              key={cell.id}
              label={getCellLabel(cell)}
              contentMode={cell.column.columnDef.meta?.contentMode}
            >
              {renderCellContent(cell)}
            </DataTableCardRow>
          ))}
        </div>
      )}

      {props.compact && wideCells.length > 0 && (
        <div className='mt-3 space-y-3 border-t pt-3'>
          {wideCells.map((cell) => (
            <DataTableCardField
              key={cell.id}
              label={getCellLabel(cell)}
              contentMode={cell.column.columnDef.meta?.contentMode ?? 'full'}
            >
              {renderCellContent(cell)}
            </DataTableCardField>
          ))}
        </div>
      )}

      {actionsCell && (
        <div className='mt-3 flex justify-end border-t pt-2'>
          {renderCellContent(actionsCell)}
        </div>
      )}
    </div>
  )
}
