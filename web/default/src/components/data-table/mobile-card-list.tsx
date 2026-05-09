import {
  flexRender,
  type Cell,
  type Row,
  type Table,
} from '@tanstack/react-table'
import { Database } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

interface MobileCardListProps<TData> {
  table: Table<TData>
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  getRowKey?: (row: Row<TData>) => string | number
  getRowClassName?: (row: Row<TData>) => string | undefined
}

interface MobileColumnMeta {
  label?: string
  mobileTitle?: boolean
  mobileBadge?: boolean
  mobileHidden?: boolean
}

function getCellMeta<TData>(
  cell: Cell<TData, unknown>
): MobileColumnMeta | undefined {
  return cell.column.columnDef.meta as MobileColumnMeta | undefined
}

function getCellLabel<TData>(cell: Cell<TData, unknown>): string | null {
  const meta = getCellMeta(cell)
  if (meta?.label) return meta.label
  const header = cell.column.columnDef.header
  return typeof header === 'string' ? header : null
}

function renderCellContent<TData>(cell: Cell<TData, unknown>): React.ReactNode {
  const cellRenderer = cell.column.columnDef.cell
  if (cellRenderer) {
    return flexRender(cellRenderer, cell.getContext())
  }
  return cell.getValue() as React.ReactNode
}

function ListSkeleton() {
  return (
    <div className='divide-y overflow-hidden rounded-lg border'>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className='px-3 py-2.5'>
          <div className='flex items-center justify-between'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-5 w-16 rounded-md' />
          </div>
          <div className='mt-1.5 grid grid-cols-2 gap-2'>
            <div className='flex-1'>
              <Skeleton className='mb-1 h-2 w-8' />
              <Skeleton className='h-4 w-full' />
            </div>
            <div className='flex-1'>
              <Skeleton className='mb-1 h-2 w-8' />
              <Skeleton className='h-4 w-full' />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function FallbackListSkeleton() {
  return (
    <div className='divide-y overflow-hidden rounded-lg border'>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className='space-y-1.5 px-3 py-2.5'>
          {[1, 2, 3].map((j) => (
            <div key={j} className='flex items-center justify-between'>
              <Skeleton className='h-2.5 w-16' />
              <Skeleton className='h-3.5 w-28' />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Compact list row — structured layout with title header + side-by-side fields.
 * Used when columns define mobileTitle or mobileBadge meta.
 *
 * Visual structure per row:
 *   [Title content]             [Badge]
 *   [Field1 label] [Field2 label]
 *   [Field1 value] [Field2 value]
 *                          [Actions ⋯]
 */
function CompactRow<TData>({ row }: { row: Row<TData> }) {
  const allCells = row
    .getVisibleCells()
    .filter((cell) => cell.column.id !== 'select')

  const titleCell = allCells.find((c) => getCellMeta(c)?.mobileTitle)
  const badgeCell = allCells.find((c) => getCellMeta(c)?.mobileBadge)
  const actionsCell = allCells.find((c) => c.column.id === 'actions')

  const fieldCells = allCells.filter(
    (c) =>
      c !== titleCell &&
      c !== badgeCell &&
      c !== actionsCell &&
      !getCellMeta(c)?.mobileHidden
  )

  return (
    <>
      {/* Row 1: Title + Badge */}
      <div className='flex items-center justify-between gap-2'>
        {titleCell && (
          <div className='min-w-0 flex-1 overflow-hidden text-sm font-medium'>
            {renderCellContent(titleCell)}
          </div>
        )}
        {badgeCell && (
          <div className='shrink-0'>{renderCellContent(badgeCell)}</div>
        )}
      </div>

      {/* Row 2: Key fields wrap into compact columns instead of squeezing */}
      {fieldCells.length > 0 && (
        <div className='mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5'>
          {fieldCells.map((cell) => {
            const label = getCellLabel(cell)
            return (
              <div key={cell.id} className='min-w-0 flex-1 overflow-hidden'>
                {label && (
                  <div className='text-muted-foreground mb-0.5 text-[10px] leading-none select-none'>
                    {label}
                  </div>
                )}
                <div className='min-w-0 overflow-hidden text-xs'>
                  {renderCellContent(cell) ?? '-'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Actions */}
      {actionsCell && (
        <div className='mt-1 -mb-0.5 flex justify-end'>
          {renderCellContent(actionsCell)}
        </div>
      )}
    </>
  )
}

/**
 * Fallback list row — condensed label:value pairs for tables without
 * mobileTitle/mobileBadge. Still respects mobileHidden.
 */
function FallbackRow<TData>({ row }: { row: Row<TData> }) {
  const allCells = row
    .getVisibleCells()
    .filter((cell) => cell.column.id !== 'select')

  const actionsCell = allCells.find((c) => c.column.id === 'actions')
  const contentCells = allCells.filter(
    (c) => c.column.id !== 'actions' && !getCellMeta(c)?.mobileHidden
  )

  return (
    <>
      {contentCells.map((cell) => {
        const label = getCellLabel(cell)
        const content = renderCellContent(cell)

        if (!label) {
          return (
            <div key={cell.id} className='flex justify-end overflow-hidden'>
              {content}
            </div>
          )
        }

        return (
          <div
            key={cell.id}
            className='flex items-start justify-between gap-2 overflow-hidden'
          >
            <span className='text-muted-foreground shrink-0 text-[10px] font-medium select-none'>
              {label}
            </span>
            <div className='flex min-w-0 flex-1 items-center justify-end overflow-hidden text-xs'>
              {content ?? '-'}
            </div>
          </div>
        )
      })}
      {actionsCell && (
        <div className='-mb-0.5 flex justify-end pt-0.5'>
          {renderCellContent(actionsCell)}
        </div>
      )}
    </>
  )
}

/**
 * Mobile-optimized list view for table data.
 *
 * Renders rows inside a single bordered container with dividers —
 * a Vercel/Stripe-style list rather than individual cards.
 *
 * Column meta extensions:
 * - `mobileTitle`  — card header (left, larger text)
 * - `mobileBadge`  — inline with title (right, e.g. status badge)
 * - `mobileHidden` — hidden on mobile
 *
 * When mobileTitle or mobileBadge is set on any column, uses a structured
 * two-tier layout: title+badge header, then 2 key fields side-by-side.
 * Otherwise falls back to a condensed single-column label:value list.
 */
export function MobileCardList<TData>(props: MobileCardListProps<TData>) {
  const {
    table,
    isLoading = false,
    emptyTitle,
    emptyDescription,
    getRowKey,
    getRowClassName,
  } = props
  const { t } = useTranslation()

  const resolvedEmptyTitle = emptyTitle ?? t('No Data')
  const resolvedEmptyDescription = emptyDescription ?? t('No data available')

  const hasCompactMeta = table.getVisibleLeafColumns().some((col) => {
    const meta = col.columnDef.meta as MobileColumnMeta | undefined
    return meta?.mobileTitle || meta?.mobileBadge
  })

  if (isLoading) {
    return hasCompactMeta ? <ListSkeleton /> : <FallbackListSkeleton />
  }

  const rows = table.getRowModel().rows

  if (!rows || rows.length === 0) {
    return (
      <div className='rounded-lg border p-6'>
        <Empty className='border-none p-0'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <Database className='size-6' />
            </EmptyMedia>
            <EmptyTitle>{resolvedEmptyTitle}</EmptyTitle>
            <EmptyDescription>{resolvedEmptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const RowComponent = hasCompactMeta ? CompactRow : FallbackRow

  return (
    <div className='divide-y overflow-hidden rounded-lg border'>
      {rows.map((row) => {
        const key = getRowKey ? getRowKey(row) : row.id
        return (
          <div
            key={key}
            className={cn('bg-card px-3 py-2.5', getRowClassName?.(row))}
          >
            <RowComponent row={row} />
          </div>
        )
      })}
    </div>
  )
}
