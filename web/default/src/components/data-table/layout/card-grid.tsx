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
import type { Row, Table } from '@tanstack/react-table'
import { Database } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CARD_STAGGER_VARIANTS,
  MOTION_TRANSITION,
  MOTION_VARIANTS,
} from '@/lib/motion'
import { cn } from '@/lib/utils'

import { tableHasCompactMeta } from './card-cell-utils'
import { CardRowContent } from './card-row-content'

/** Helpers passed to a custom {@link DataTableCardGridProps.renderCard}. */
export type DataTableCardHelpers = {
  /**
   * Whether the table declares compact card meta (`mobileTitle`/`mobileBadge`).
   * Provided so custom renderers can match the default layout decision.
   */
  compact: boolean
  /**
   * Row selection state captured before entering memoized custom card renderers.
   */
  isSelected: boolean
}

export interface DataTableCardGridProps<TData> {
  table: Table<TData>
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: React.ReactNode
  getRowKey?: (row: Row<TData>) => string | number
  getRowClassName?: (row: Row<TData>) => string | undefined
  /**
   * Custom card renderer. When omitted, cards render generically from the
   * column definitions via {@link CardRowContent} (driven by column meta).
   */
  renderCard?: (
    row: Row<TData>,
    helpers: DataTableCardHelpers
  ) => React.ReactNode
  /**
   * Responsive grid className override. Defaults to a 1/2/3-column grid.
   */
  gridClassName?: string
  /** Stable key prefix for skeleton cards. */
  skeletonKeyPrefix?: string
}

const DEFAULT_GRID_CLASSNAME =
  'grid grid-cols-1 gap-3 sm:gap-3.5 md:grid-cols-2 xl:grid-cols-3'

const cardItemTransition = MOTION_TRANSITION.default

function CardGridSkeleton(props: {
  gridClassName?: string
  keyPrefix?: string
}) {
  const prefix = props.keyPrefix ?? 'card-skeleton'
  return (
    <div className={props.gridClassName ?? DEFAULT_GRID_CLASSNAME}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={`${prefix}-${i}`}
          className='border-border/60 bg-card space-y-3 rounded-xl border p-3.5'
        >
          <div className='flex items-center justify-between gap-2'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-5 w-16 rounded-md' />
          </div>
          <div className='grid grid-cols-2 gap-x-3 gap-y-1.5'>
            {[1, 2, 3, 4].map((j) => (
              <div key={j}>
                <Skeleton className='mb-1 h-2 w-8' />
                <Skeleton className='h-4 w-full' />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Desktop card view for table data — a responsive grid of soft cards with
 * staggered enter motion.
 */
export function DataTableCardGrid<TData>(props: DataTableCardGridProps<TData>) {
  const { t } = useTranslation()
  const shouldReduce = useReducedMotion()

  const resolvedEmptyTitle = props.emptyTitle ?? t('No Data')
  const resolvedEmptyDescription =
    props.emptyDescription ?? t('No data available')

  const visibleColumns = props.table.getVisibleLeafColumns()
  const compact = React.useMemo(
    () => tableHasCompactMeta(props.table),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleColumns]
  )

  if (props.isLoading) {
    return (
      <CardGridSkeleton
        gridClassName={props.gridClassName}
        keyPrefix={props.skeletonKeyPrefix}
      />
    )
  }

  const rows = props.table.getRowModel().rows

  if (!rows || rows.length === 0) {
    return (
      <div className='border-border/60 bg-card/40 rounded-xl border border-dashed p-8'>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              {props.emptyIcon ?? <Database className='size-6' />}
            </EmptyMedia>
            <EmptyTitle>{resolvedEmptyTitle}</EmptyTitle>
            <EmptyDescription>{resolvedEmptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const gridClass = props.gridClassName ?? DEFAULT_GRID_CLASSNAME

  if (shouldReduce) {
    return (
      <div className={gridClass}>
        {rows.map((row) => {
          const key = props.getRowKey ? props.getRowKey(row) : row.id
          const isSelected = row.getIsSelected()
          return (
            <div
              key={key}
              data-slot='data-table-card'
              data-state={isSelected ? 'selected' : undefined}
              className={cn(
                'border-border/60 bg-card hover:border-border hover:bg-card/90 rounded-xl border px-3.5 py-3 shadow-[0_1px_0_0_color-mix(in_oklch,var(--foreground)_3%,transparent)] transition-[background-color,border-color,box-shadow] duration-150',
                'data-[state=selected]:border-primary/35 data-[state=selected]:bg-primary/5',
                props.getRowClassName?.(row)
              )}
            >
              {props.renderCard ? (
                props.renderCard(row, { compact, isSelected })
              ) : (
                <CardRowContent row={row} compact={compact} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <motion.div
      className={gridClass}
      variants={CARD_STAGGER_VARIANTS}
      initial='initial'
      animate='animate'
    >
      {rows.map((row) => {
        const key = props.getRowKey ? props.getRowKey(row) : row.id
        const isSelected = row.getIsSelected()
        return (
          <motion.div
            key={key}
            data-slot='data-table-card'
            data-state={isSelected ? 'selected' : undefined}
            variants={{
              initial: MOTION_VARIANTS.cardItem.initial,
              animate: {
                ...MOTION_VARIANTS.cardItem.animate,
                transition: cardItemTransition,
              },
            }}
            whileHover={{ y: -2, transition: { duration: 0.15 } }}
            className={cn(
              'border-border/60 bg-card hover:border-border rounded-xl border px-3.5 py-3 shadow-[0_1px_0_0_color-mix(in_oklch,var(--foreground)_3%,transparent)] transition-[background-color,border-color,box-shadow] duration-150',
              'data-[state=selected]:border-primary/35 data-[state=selected]:bg-primary/5',
              props.getRowClassName?.(row)
            )}
          >
            {props.renderCard ? (
              props.renderCard(row, { compact, isSelected })
            ) : (
              <CardRowContent row={row} compact={compact} />
            )}
          </motion.div>
        )
      })}
    </motion.div>
  )
}
