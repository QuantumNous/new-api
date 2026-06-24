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
import { memo } from 'react'
import { flexRender, type Row } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { GroupBadge } from '@/components/group-badge'
import { CHANNEL_STATUS } from '../constants'
import { isTagAggregateRow, parseGroupsList } from '../lib'
import type { Channel } from '../types'
import { ChannelRowActionsLayoutContext } from './channel-row-actions-context'
import { useChannels } from './channels-provider'

const SENSITIVE_MASK = '••••'

/**
 * Bespoke channel card for the card view. Reuses every column's existing cell
 * renderer via `flexRender`, so the table's information and interactions are
 * preserved: row selection, provider/multi-key/IO.NET type badge, id,
 * name/remark + warning icons, status (with tooltips), groups, inline
 * priority/weight spinners, balance refresh, response/test times, tag
 * expand-collapse, and the per-row (or per-tag) actions menu.
 */
function ChannelCardComponent({
  row,
  isSelected,
}: {
  row: Row<Channel>
  isSelected: boolean
}) {
  const { t } = useTranslation()
  const { sensitiveVisible } = useChannels()
  const isTagRow = isTagAggregateRow(row.original)
  const cells = row.getAllCells()

  const renderCell = (id: string) => {
    const cell = cells.find((c) => c.column.id === id)
    if (!cell || !cell.column.columnDef.cell) {
      return null
    }
    return flexRender(cell.column.columnDef.cell, cell.getContext())
  }

  const fieldLabels: Record<string, string> = {
    balance: t('Used / Remaining'),
    response_time: t('Response'),
    test_time: t('Last Tested'),
  }

  const groups = parseGroupsList(row.original.group ?? '')

  const selectCell = renderCell('select')
  const typeCell = renderCell('type')
  const nameCell = renderCell('name')
  const statusCell = renderCell('status')
  const actionsCell = renderCell('actions')
  const priorityCell = renderCell('priority')
  const weightCell = renderCell('weight')
  const balanceCell = renderCell('balance')
  const responseCell = renderCell('response_time')
  const testCell = renderCell('test_time')

  const labelClass = 'text-muted-foreground text-[11px] font-medium select-none'

  // In card view the enable/disable state is already conveyed by the inline
  // power toggle, so the plain "Enabled"/"Disabled" badge is redundant. Keep
  // only the informative states (e.g. auto-disabled, unknown) and tag rows.
  const showStatusBadge =
    isTagRow ||
    (row.original.status !== CHANNEL_STATUS.ENABLED &&
      row.original.status !== CHANNEL_STATUS.MANUAL_DISABLED)

  return (
    <div
      data-state={isSelected ? 'selected' : undefined}
      className='flex flex-col gap-3'
    >
      {/* Row 1: selection + type, with status badge + actions menu */}
      <div className='flex items-center justify-between gap-2'>
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          {!isTagRow && selectCell && (
            <span className='shrink-0'>{selectCell}</span>
          )}
          <div className='min-w-0 overflow-hidden'>{typeCell}</div>
        </div>
        <div className='flex shrink-0 items-center gap-1.5'>
          {showStatusBadge && statusCell}
          <ChannelRowActionsLayoutContext.Provider value='card'>
            {actionsCell}
          </ChannelRowActionsLayoutContext.Provider>
        </div>
      </div>

      {/* Body: left column (id/name + balance) paired with a right-aligned
          column (priority/weight + response/test time). */}
      <div className='flex items-start justify-between gap-3'>
        {/* Left column */}
        <div className='flex min-w-0 flex-1 flex-col gap-3 overflow-hidden'>
          <div className='min-w-0 text-sm'>
            {!isTagRow && (
              <div className={labelClass}>
                #{sensitiveVisible ? row.original.id : SENSITIVE_MASK}
              </div>
            )}
            {nameCell}
          </div>
          <div className='min-w-0'>
            <div className={cn('mb-1', labelClass)}>{fieldLabels.balance}</div>
            <div className='min-w-0 overflow-hidden text-sm'>
              {balanceCell ?? <span className='text-muted-foreground'>-</span>}
            </div>
          </div>
        </div>

        {/* Right column (sits on the right, content left-aligned). A single
            grid with content-sized columns keeps Priority/Weight and
            Response/Last Tested aligned without wasting horizontal space. */}
        <div className='grid shrink-0 grid-cols-[auto_auto] items-center gap-x-3 gap-y-1'>
          <span className={labelClass}>{t('Priority')}</span>
          <span className={labelClass}>{t('Weight')}</span>
          <div className='flex justify-start'>{priorityCell}</div>
          <div className='flex justify-start'>{weightCell}</div>
          <span className={cn('mt-2', labelClass)}>
            {fieldLabels.response_time}
          </span>
          <span className={cn('mt-2', labelClass)}>{fieldLabels.test_time}</span>
          <div className='overflow-hidden text-sm'>
            {responseCell ?? <span className='text-muted-foreground'>-</span>}
          </div>
          <div className='overflow-hidden text-sm'>
            {testCell ?? <span className='text-muted-foreground'>-</span>}
          </div>
        </div>
      </div>

      {/* Last row: groups span the full width, showing every group (no label) */}
      <div className='min-w-0'>
        {groups.length > 0 ? (
          <div className='-ml-1.5 flex flex-wrap gap-1'>
            {groups.map((g) => (
              <GroupBadge
                key={g}
                group={g}
                label={sensitiveVisible ? undefined : SENSITIVE_MASK}
                size='sm'
              />
            ))}
          </div>
        ) : (
          <span className='text-muted-foreground text-sm'>-</span>
        )}
      </div>
    </div>
  )
}

/**
 * Memoized so each card only re-renders when its own react-table row reference
 * changes, instead of every card re-rendering whenever the parent table state
 * (filters, pagination, sensitive toggle, etc.) updates.
 */
export const ChannelCard = memo(ChannelCardComponent)
