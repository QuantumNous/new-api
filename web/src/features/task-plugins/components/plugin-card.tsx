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
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { PluginIcon } from './plugin-icon'
import type { TaskPluginListItem } from '../types'
import { UsageSchemaTable } from './usage-schema-table'

/**
 * Bespoke task-plugin card for the card view. Reuses the column cell renderers
 * via `flexRender` so the table and card views share one implementation of the
 * source/runtime badges, the enable switch (with its usage-guard mutation),
 * and the actions menu.
 */
function PluginCardComponent({ row }: { row: Row<TaskPluginListItem> }) {
  const { t } = useTranslation()
  const cells = row.getAllCells()

  const renderCell = (id: string) => {
    const cell = cells.find((c) => c.column.id === id)
    if (!cell || !cell.column.columnDef.cell) {
      return null
    }
    return flexRender(cell.column.columnDef.cell, cell.getContext())
  }

  const labelClass = 'text-muted-foreground text-[11px] font-medium select-none'

  return (
    <div className='flex h-full flex-col gap-2.5'>
      {/* Row 1: type icon + name/key, with runtime status + actions menu */}
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 flex-1 items-center gap-2.5'>
          <span className='mt-0.5 shrink-0'>
            <PluginIcon plugin={row.original.meta} size={20} />
          </span>
          <div className='min-w-0'>
            <div className='truncate text-sm font-medium'>
              {row.original.meta.name}
            </div>
            <div className='text-muted-foreground truncate font-mono text-xs'>
              {row.original.meta.key}
            </div>
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-1.5'>
          {renderCell('actions')}
        </div>
      </div>

      {/* Row 2: source + runtime badges wrap freely */}
      <div className='flex flex-wrap items-center gap-1.5'>
        {renderCell('source')}
        {renderCell('runtime')}
      </div>

      {/* Row 3: key fields in compact labeled columns */}
      <div className='grid grid-cols-3 gap-x-3 gap-y-1'>
        <div className='min-w-0'>
          <div className={labelClass}>{t('Active version')}</div>
          <div className='truncate font-mono text-xs'>
            {row.original.meta.version || '-'}
          </div>
        </div>
        <div className='min-w-0'>
          <div className={labelClass}>{t('API version')}</div>
          <div className='truncate font-mono text-xs'>
            {row.original.meta.apiVersion}
          </div>
        </div>
        <div className='min-w-0'>
          <div className={labelClass}>{t('Models')}</div>
          <div className='truncate text-xs'>
            {row.original.meta.models?.length ?? 0}
          </div>
        </div>
      </div>

      {row.original.meta.usageSchema &&
        Object.keys(row.original.meta.usageSchema).length > 0 && (
          <div className='space-y-1.5 border-t pt-2'>
            <div className={labelClass}>{t('Billing parameters')}</div>
            <UsageSchemaTable schema={row.original.meta.usageSchema} compact />
          </div>
        )}

      {/* Footer: enabled toggle pinned to the card bottom */}
      <div className='mt-auto flex items-center justify-between gap-2 border-t pt-2'>
        <span className={labelClass}>{t('Enabled')}</span>
        {renderCell('enabled')}
      </div>
    </div>
  )
}

/**
 * Memoized so each card only re-renders when its own react-table row reference
 * changes rather than on every parent table state update.
 */
export const PluginCard = memo(PluginCardComponent)
