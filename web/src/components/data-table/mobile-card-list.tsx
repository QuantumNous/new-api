import {
  flexRender,
  type Cell,
  type Row,
  type Table,
} from '@tanstack/react-table'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TableEmpty } from './table-empty'

interface MobileCardListProps<TData> {
  table: Table<TData>
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  getRowKey?: (row: Row<TData>) => string | number
}

// Render a TanStack cell with the full context
function renderCellContent<TData>(cell: Cell<TData, unknown>): React.ReactNode {
  const { column } = cell
  const cellRenderer = column.columnDef.cell

  if (cellRenderer) {
    return flexRender(cellRenderer, cell.getContext())
  }

  return cell.getValue() as React.ReactNode
}

/**
 * Mobile-optimized card list for displaying table data
 * Renders each row as a compact card with label-value pairs
 */
export function MobileCardList<TData>({
  table,
  isLoading = false,
  emptyTitle = 'No Data',
  emptyDescription = 'No data available',
  getRowKey,
}: MobileCardListProps<TData>) {
  const visibleColumns = table
    .getVisibleLeafColumns()
    .filter((column) => column.id !== 'select')
  const skeletonColumnCount = visibleColumns.filter(
    (column) => column.id !== 'actions'
  ).length

  if (isLoading) {
    return (
      <div className='flex flex-col gap-2'>
        {[1, 2, 3].map((i) => (
          <Card key={i} className='p-3'>
            <div className='space-y-2'>
              {Array.from(
                { length: Math.min(Math.max(skeletonColumnCount, 1), 5) },
                (_, idx) => (
                  <div
                    key={idx}
                    className='flex items-center justify-between border-b border-dashed pb-1.5 last:border-b-0'
                  >
                    <Skeleton className='h-3 w-20' />
                    <Skeleton className='h-3 w-32' />
                  </div>
                )
              )}
              <div className='flex justify-end pt-1'>
                <Skeleton className='h-8 w-24' />
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const rows = table.getRowModel().rows

  if (!rows || rows.length === 0) {
    return (
      <div className='rounded-md border p-8'>
        <TableEmpty
          colSpan={1}
          title={emptyTitle}
          description={emptyDescription}
        />
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      {rows.map((row) => {
        const key = getRowKey ? getRowKey(row) : row.id
        const mobileCells = row
          .getVisibleCells()
          .filter((cell) => cell.column.id !== 'select')
        const actionsCell = mobileCells.find(
          (cell) => cell.column.id === 'actions'
        )
        const fieldCells = mobileCells.filter(
          (cell) => cell.column.id !== 'actions'
        )

        return (
          <Card key={key} className='overflow-hidden p-3'>
            <div className='space-y-1.5'>
              {fieldCells.map((cell) => {
                const columnDef = cell.column.columnDef
                const meta = columnDef.meta as { label?: string } | undefined
                const label =
                  meta?.label ||
                  (typeof columnDef.header === 'string'
                    ? columnDef.header
                    : null)

                const cellContent = renderCellContent(cell)

                if (!label) {
                  return (
                    <div
                      key={cell.id}
                      className='flex justify-end overflow-hidden'
                    >
                      {cellContent}
                    </div>
                  )
                }

                return (
                  <div
                    key={cell.id}
                    className='flex items-start justify-between gap-2 overflow-hidden border-b border-dashed pb-1.5 last:border-b-0'
                  >
                    <span className='text-muted-foreground min-w-[80px] shrink-0 text-xs font-medium select-none'>
                      {label}
                    </span>
                    <div className='flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1 overflow-hidden text-sm'>
                      {cellContent ?? '-'}
                    </div>
                  </div>
                )
              })}

              {actionsCell && (
                <div
                  className='flex justify-end overflow-hidden pt-1'
                  key={actionsCell.id}
                >
                  {renderCellContent(actionsCell)}
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
