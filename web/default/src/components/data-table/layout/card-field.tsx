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
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type DataTableContentMode = 'full' | 'wrap' | 'summary'

const VALUE_WRAP_CLASS =
  'whitespace-normal break-words [overflow-wrap:anywhere] [&_.truncate]:overflow-visible [&_.truncate]:text-clip [&_.truncate]:whitespace-normal'

interface DataTableCardFieldProps {
  children: ReactNode
  className?: string
  contentMode?: DataTableContentMode
  label?: ReactNode
  span?: 1 | 2
  valueClassName?: string
}

/**
 * Stacked label-above-value field. Prefer {@link DataTableCardRow} for dense
 * scannable cards; keep this for multi-line badge collections.
 */
export function DataTableCardField({
  children,
  className,
  contentMode = 'wrap',
  label,
  span = 1,
  valueClassName,
}: DataTableCardFieldProps) {
  return (
    <div
      data-slot='data-table-card-field'
      className={cn('min-w-0', span === 2 && 'col-span-2', className)}
    >
      {label && (
        <div className='text-muted-foreground mb-1.5 text-xs leading-none select-none'>
          {label}
        </div>
      )}
      <div
        data-slot='data-table-card-value'
        className={cn(
          'min-w-0 text-sm leading-snug',
          (contentMode === 'full' || contentMode === 'wrap') &&
            VALUE_WRAP_CLASS,
          contentMode === 'full' && 'break-all',
          valueClassName
        )}
      >
        {children ?? '-'}
      </div>
    </div>
  )
}

interface DataTableCardRowProps {
  children: ReactNode
  className?: string
  contentMode?: DataTableContentMode
  label: ReactNode
  valueClassName?: string
}

/**
 * Dense definition-list row: muted label left, value right.
 * Always visible — no progressive disclosure / "More" click required.
 */
export function DataTableCardRow({
  children,
  className,
  contentMode = 'wrap',
  label,
  valueClassName,
}: DataTableCardRowProps) {
  return (
    <div
      data-slot='data-table-card-row'
      className={cn(
        'flex min-h-6 items-start justify-between gap-4 py-0.5',
        className
      )}
    >
      <span className='text-muted-foreground shrink-0 pt-0.5 text-xs select-none'>
        {label}
      </span>
      <div
        data-slot='data-table-card-value'
        className={cn(
          'flex min-w-0 flex-wrap items-center justify-end gap-1 text-right text-sm leading-snug',
          (contentMode === 'full' || contentMode === 'wrap') &&
            VALUE_WRAP_CLASS,
          contentMode === 'full' && 'break-all',
          valueClassName
        )}
      >
        {children ?? <span className='text-muted-foreground'>-</span>}
      </div>
    </div>
  )
}
